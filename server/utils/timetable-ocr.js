const { createWorker, PSM } = require('tesseract.js');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const START_TIMES = ['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00'];
const END_TIMES = ['10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00'];
const SLOT_WEIGHTS = [1, 1, 1, 1, 0.5, 1, 1, 1];

// ponytail: one OCR job at a time protects a small server; add a queue only if import traffic grows.
let activeRecognition = false;
const cachePath = path.join(os.tmpdir(), 'findmyclass-ocr');

function flattenLines(blocks) {
  return (blocks || [])
    .flatMap((block) => block.paragraphs || [])
    .flatMap((paragraph) => paragraph.lines || []);
}

function parseLegend(text) {
  const subjects = new Map();
  const faculty = new Map();

  for (const line of String(text || '').split(/\r?\n/)) {
    const metadata = line.match(/\b([LP])\/(?:[A-Z]+\/)+[A-Z]+\b/);
    if (!metadata) continue;
    const parts = metadata[0].split('/');
    const type = parts.shift();
    const facultyCode = parts.pop();
    const subjectCode = parts.join('/');
    const subjectName = line.slice(0, metadata.index)
      .replace(/^.*?\bN[A-Z0-9]{5,}\b\W*/, '')
      .replace(/^\W*\d+\W*/, '')
      .replace(/[|_[\]]+/g, ' ')
      .trim();
    const facultyName = line.slice(metadata.index + metadata[0].length)
      .replace(/^\W+/, '')
      .trim();

    if (subjectName) subjects.set(`${type}/${subjectCode}`, subjectName);
    if (facultyName) faculty.set(facultyCode, facultyName);
  }

  return { subjects, faculty };
}

function editDistance(left, right) {
  const row = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    let previous = row[0];
    row[0] = leftIndex;
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      const current = row[rightIndex];
      row[rightIndex] = Math.min(
        row[rightIndex] + 1,
        row[rightIndex - 1] + 1,
        previous + (left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1)
      );
      previous = current;
    }
  }
  return row[right.length];
}

function closestCode(value, candidates) {
  let best = value;
  let bestDistance = 3;
  for (const candidate of candidates) {
    const distance = editDistance(value, candidate);
    if (distance < bestDistance) {
      best = candidate;
      bestDistance = distance;
    }
  }
  return best;
}

function cleanCell(value) {
  let cleaned = String(value || '').toUpperCase().replace(/,/g, '/').replace(/\s+/g, '');
  const metadataStart = cleaned.search(/[LP]\//);
  if (metadataStart >= 0) cleaned = cleaned.slice(metadataStart);
  else if (cleaned.includes('/')) cleaned = `L${cleaned.slice(cleaned.indexOf('/'))}`;
  return cleaned.replace(/[^A-Z0-9/]/g, '');
}

function parseMetadata(value, legend) {
  if (/^LIB/.test(value)) {
    return {
      sessionType: 'Library',
      subjectName: 'Library',
      facultyName: 'Library staff',
      classroom: 'Central Library',
    };
  }

  const parts = cleanCell(value).split('/').filter(Boolean);
  if (!['L', 'P'].includes(parts[0]) || parts.length < 4) return null;
  const type = parts.shift();
  const classroom = parts.pop();
  if (!/^(?:[1-5]\d{2}|(?:UGF|LGF)\d{3}|CH)$/.test(classroom)) return null;

  let facultyCode = parts.pop();
  let subjectCode = parts.join('/');
  const subjectCandidates = [...legend.subjects.keys()]
    .filter((key) => key.startsWith(`${type}/`))
    .map((key) => key.slice(2));
  subjectCode = closestCode(subjectCode, subjectCandidates);
  facultyCode = closestCode(facultyCode, legend.faculty.keys());

  return {
    subjectCode,
    subjectName: legend.subjects.get(`${type}/${subjectCode}`) || subjectCode,
    facultyCode,
    facultyName: legend.faculty.get(facultyCode) || facultyCode,
    sessionType: type === 'P' ? 'Practical' : 'Lecture',
    classroom,
  };
}

function stripMetadata(text, legend) {
  return String(text || '')
    .replace(/[|[\],]/g, ' ')
    .split(/\s+/)
    .map(cleanCell)
    .map((value) => parseMetadata(value, legend))
    .filter(Boolean);
}

async function recognizeGridRows(worker, image, data) {
  const pageLines = flattenLines(data.blocks);
  const creditHeader = pageLines.find((line) => /\bCredit\b/i.test(line.text) && /Course/i.test(line.text));
  if (!creditHeader) return [];

  const academicHeader = pageLines.find((line) => /Academic Session/i.test(line.text));
  const width = Math.max(...pageLines.map((line) => line.bbox.x1));
  const height = Math.max(...pageLines.map((line) => line.bbox.y1));
  const gridTop = academicHeader
    ? academicHeader.bbox.y1 + (creditHeader.bbox.y0 - academicHeader.bbox.y1) * 0.08
    : height * 0.02;
  const gridBottom = creditHeader.bbox.y0 - (creditHeader.bbox.y0 - gridTop) * 0.05;
  const rowHeight = (gridBottom - gridTop) / 6;
  if (width <= 0 || rowHeight <= 0) return [];

  const legend = parseLegend(data.text);
  await worker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_BLOCK, preserve_interword_spaces: '1' });
  const strips = [];
  let dataStart = academicHeader ? width * 0.142 : width * 0.08;

  for (let dayIndex = 0; dayIndex < DAYS.length; dayIndex += 1) {
    const top = Math.round(gridTop + rowHeight * (dayIndex + 1));
    const result = await worker.recognize(image, {
      rectangle: { left: 0, top, width, height: Math.round(rowHeight) },
    }, { blocks: true });
    strips.push(result.data.text.trim());
    const dayWord = flattenLines(result.data.blocks)
      .flatMap((line) => line.words || [])
      .find((word) => /^(?:Mon|Tue|Wed|Thu|Fri)/i.test(word.text));
    if (dayWord) dataStart = Math.max(dataStart, dayWord.bbox.x1 + width * 0.018);
  }

  const regularSlotWidth = (width - dataStart) / 7.5;
  const boundaries = [dataStart];
  for (const weight of SLOT_WEIGHTS) boundaries.push(boundaries.at(-1) + regularSlotWidth * weight);

  await worker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_LINE });
  const rows = [];
  for (let dayIndex = 0; dayIndex < DAYS.length; dayIndex += 1) {
    const cells = [];
    for (let slot = 0; slot < SLOT_WEIGHTS.length; slot += 1) {
      const result = await worker.recognize(image, {
        rectangle: {
          left: Math.round(boundaries[slot] + 2),
          top: Math.round(gridTop + rowHeight * (dayIndex + 1) + 3),
          width: Math.max(1, Math.round(boundaries[slot + 1] - boundaries[slot] - 4)),
          height: Math.max(1, Math.round(rowHeight - 6)),
        },
      });
      cells.push(result.data.text.trim());
    }

    const corrections = stripMetadata(strips[dayIndex], legend);
    const usedCorrections = new Set();
    for (let slot = 0; slot < cells.length; slot += 1) {
      if (slot === 4) continue;
      let parsed = parseMetadata(cleanCell(cells[slot]), legend);
      let duration = 1;
      if (!parsed && slot + 1 < cells.length && slot + 1 !== 4) {
        parsed = parseMetadata(cleanCell(`${cells[slot]}${cells[slot + 1]}`), legend);
        if (parsed) duration = 2;
      }
      if (!parsed) continue;

      const correctionIndex = corrections.findIndex((candidate, index) => (
        !usedCorrections.has(index)
        && candidate.sessionType === parsed.sessionType
        && candidate.subjectCode === parsed.subjectCode
        && candidate.facultyCode === parsed.facultyCode
      ));
      if (correctionIndex >= 0) {
        parsed.classroom = corrections[correctionIndex].classroom;
        usedCorrections.add(correctionIndex);
      }

      rows.push({
        day: DAYS[dayIndex],
        startTime: START_TIMES[slot],
        endTime: END_TIMES[slot + duration - 1],
        ...parsed,
      });
      slot += duration - 1;
    }

    if (rows.some((row) => row.day === DAYS[dayIndex])) {
      rows.push({
        day: DAYS[dayIndex],
        startTime: '13:00',
        endTime: '14:00',
        subjectName: 'Lunch break',
        sessionType: 'Break',
      });
    }
  }

  return rows;
}

async function extractTimetableImage(buffer) {
  if (activeRecognition) {
    const error = new Error('Another timetable image is being processed. Please try again shortly.');
    error.status = 429;
    throw error;
  }

  activeRecognition = true;
  let worker;
  try {
    fs.mkdirSync(cachePath, { recursive: true });
    worker = await createWorker('eng', undefined, { cachePath });
    await worker.setParameters({ tessedit_pageseg_mode: PSM.AUTO, preserve_interword_spaces: '1' });
    const result = await worker.recognize(buffer, {}, { blocks: true });
    return {
      text: result.data.text,
      rows: await recognizeGridRows(worker, buffer, result.data),
    };
  } finally {
    activeRecognition = false;
    await worker?.terminate();
  }
}

module.exports = { extractTimetableImage };
