const { createWorker, PSM } = require('tesseract.js');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const START_TIMES = ['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00'];
const END_TIMES = ['10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00'];
const SLOT_WEIGHTS = [1, 1, 1, 1, 0.5, 1, 1, 1];
const SLOT_CENTERS = SLOT_WEIGHTS.map((weight, index) => (
  SLOT_WEIGHTS.slice(0, index).reduce((sum, value) => sum + value, 0) + weight / 2
));

// ponytail: one OCR job at a time protects a small server; add a queue only if import traffic grows.
let activeRecognition = false;
const cachePath = path.join(os.tmpdir(), 'findmyclass-ocr');

function flattenLines(blocks) {
  return (blocks || [])
    .flatMap((block) => block.paragraphs || [])
    .flatMap((paragraph) => paragraph.lines || []);
}

async function recognizeCoordinatorStrip(worker, image, data) {
  const pageLines = flattenLines(data.blocks);
  const creditHeader = pageLines.find((line) => /\bCredit\b/i.test(line.text) && /Course/i.test(line.text));
  const academicHeader = pageLines.find((line) => /Academic Session/i.test(line.text));
  if (!creditHeader) return '';

  const width = Math.max(...pageLines.map((line) => line.bbox.x1));
  const gridTop = academicHeader?.bbox.y1 || creditHeader.bbox.y0 - width * 0.3;
  const rowHeight = (creditHeader.bbox.y0 - gridTop) / 6;
  const top = Math.max(0, Math.round(creditHeader.bbox.y0 - Math.max(22, rowHeight * 0.5)));
  await worker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_LINE, preserve_interword_spaces: '1' });
  const result = await worker.recognize(image, {
    rectangle: { left: 0, top, width, height: Math.max(1, Math.round(creditHeader.bbox.y0 - top)) },
  });
  return result.data.text.trim();
}

function parseLegend(text) {
  const subjects = new Map();
  const faculty = new Map();
  const entries = [];

  for (const line of String(text || '').split(/\r?\n/)) {
    const facultyMatch = line.match(/\b(?:Mr|Ms|Dr)\.?\s*.+$/);
    const courseMatch = line.match(/\bN[A-Z0-9]{5,}/i);
    if (!facultyMatch || !courseMatch || facultyMatch.index <= courseMatch.index) continue;

    const beforeFaculty = line
      .slice(courseMatch.index + courseMatch[0].length, facultyMatch.index)
      .replace(/[_|]+\s*$/, '')
      .trimEnd();
    const metadata = beforeFaculty.match(/([LPI/]?[A-Z][A-Z/]{3,})\s*\|?\s*$/i);
    if (!metadata) continue;

    let rawMetadata = metadata[1].toUpperCase();
    if (rawMetadata.startsWith('/')) rawMetadata = `L${rawMetadata}`;
    if (/^[LP][^/]/.test(rawMetadata)) rawMetadata = `${rawMetadata[0]}/${rawMetadata.slice(1)}`;
    const parts = rawMetadata.split('/').filter(Boolean);
    const type = ['L', 'P'].includes(parts[0]) ? parts.shift() : 'L';
    let facultyCode = parts.pop() || '';
    let subjectCode = parts.join('/');
    if (!subjectCode && facultyCode.length > 2) {
      subjectCode = facultyCode.slice(0, -2);
      facultyCode = facultyCode.slice(-2);
    }
    if (!subjectCode || !facultyCode) continue;

    let subjectName = beforeFaculty.slice(0, metadata.index)
      .replace(/[|_[\]]+/g, ' ')
      .replace(/[‘’]\s*C["”]/g, "'C'")
      .trim();
    const facultyName = facultyMatch[0].replace(/^\W+/, '').trim();
    if (subjectCode.startsWith('I') && compactCell(subjectName) === compactCell(subjectCode.slice(1))) {
      subjectCode = subjectCode.slice(1);
      subjectName = subjectCode;
    }

    if (subjectName) subjects.set(`${type}/${subjectCode}`, subjectName);
    if (facultyName) faculty.set(facultyCode, facultyName);
    entries.push({ type, subjectCode, subjectName, facultyCode, facultyName });
  }

  const coordinatorName = String(text || '').match(/Class Coordinator\s*:\s*((?:Mr|Ms|Dr)\.?\s+[A-Za-z. ]+)/i)?.[1]?.trim();
  if (coordinatorName) {
    const normalizedCoordinator = compactCell(coordinatorName);
    for (const entry of entries) {
      if (editDistance(compactCell(entry.facultyName), normalizedCoordinator) <= 2) {
        entry.facultyName = coordinatorName;
        faculty.set(entry.facultyCode, coordinatorName);
      }
    }
  }

  return { subjects, faculty, entries };
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

function compactCell(value) {
  return String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function normalizeDigits(value) {
  return value.replace(/O/g, '0').replace(/I/g, '1').replace(/S/g, '8');
}

function splitRoom(value) {
  const compact = compactCell(value);
  const special = compact.match(/(?:UGF|LGF)[0-9OIS]{3}$/);
  if (special) {
    const prefix = special[0].slice(0, 3);
    return { metadata: compact.slice(0, special.index), classroom: `${prefix}${normalizeDigits(special[0].slice(3))}` };
  }

  const lab = compact.match(/LAB\d{1,2}$/);
  if (lab) return { metadata: compact.slice(0, lab.index), classroom: `Lab${lab[0].slice(3)}` };
  if (compact.endsWith('CH')) return { metadata: compact.slice(0, -2), classroom: 'CH' };

  const numbered = compact.match(/(?:A([0-9OIS]{2,3})|([0-9][0-9OIS]{1,2}))$/);
  if (!numbered) return null;
  let classroom = normalizeDigits(numbered[1] || numbered[2]);
  if (classroom.length === 2) classroom = `4${classroom}`;
  return { metadata: compact.slice(0, numbered.index), classroom };
}

function parseMetadata(value, legend) {
  const compact = compactCell(value);
  if (/^LIB/.test(compact) || ['LB', 'US'].includes(compact)) {
    return {
      sessionType: 'Library',
      subjectName: 'Library',
      facultyName: 'Library staff',
      classroom: 'Central Library',
    };
  }

  const split = splitRoom(value);
  if (!split || !legend.entries.length) return null;
  let best;
  for (const entry of legend.entries) {
    const expected = `${entry.type}${compactCell(entry.subjectCode)}${entry.facultyCode}`;
    const distance = editDistance(split.metadata, expected);
    if (!best || distance < best.distance) best = { entry, distance, expected };
  }
  if (!best || best.distance > Math.max(2, Math.ceil(best.expected.length * 0.25))) return null;

  return {
    subjectCode: best.entry.subjectCode,
    subjectName: best.entry.subjectName || best.entry.subjectCode,
    facultyCode: best.entry.facultyCode,
    facultyName: best.entry.facultyName || best.entry.facultyCode,
    sessionType: best.entry.type === 'P' ? 'Practical' : 'Lecture',
    classroom: split.classroom,
  };
}

function fitSlotBoundaries(headerCenters, fallbackLeft, fallbackRight) {
  if (headerCenters.length === SLOT_CENTERS.length) {
    const meanX = headerCenters.reduce((sum, value) => sum + value, 0) / headerCenters.length;
    const meanSlot = SLOT_CENTERS.reduce((sum, value) => sum + value, 0) / SLOT_CENTERS.length;
    const numerator = headerCenters.reduce((sum, value, index) => (
      sum + (SLOT_CENTERS[index] - meanSlot) * (value - meanX)
    ), 0);
    const denominator = SLOT_CENTERS.reduce((sum, value) => sum + (value - meanSlot) ** 2, 0);
    const regularWidth = numerator / denominator;
    const left = meanX - regularWidth * meanSlot;
    if (regularWidth > 20 && left >= 0) {
      const boundaries = [left];
      for (const weight of SLOT_WEIGHTS) boundaries.push(boundaries.at(-1) + regularWidth * weight);
      return boundaries;
    }
  }

  const regularWidth = (fallbackRight - fallbackLeft) / 7.5;
  const boundaries = [fallbackLeft];
  for (const weight of SLOT_WEIGHTS) boundaries.push(boundaries.at(-1) + regularWidth * weight);
  return boundaries;
}

function slotAtX(x, boundaries) {
  const slot = boundaries.findIndex((right, index) => index > 0 && x < right) - 1;
  return Math.max(0, Math.min(SLOT_WEIGHTS.length - 1, slot));
}

function groupScheduleWords(line, boundaries) {
  const dataLeft = boundaries[0];
  const groups = [];
  for (const word of line.words || []) {
    const text = String(word.text || '').trim();
    const center = (word.bbox.x0 + word.bbox.x1) / 2;
    if (!/[A-Z0-9]/i.test(text) || center < dataLeft || slotAtX(center, boundaries) === 4) continue;
    const slot = slotAtX(center, boundaries);
    const previous = groups.at(-1);
    if (previous && previous.slot === slot) {
      previous.text += text;
      previous.x1 = word.bbox.x1;
    } else {
      groups.push({ text, slot, x0: word.bbox.x0, x1: word.bbox.x1 });
    }
  }
  return groups;
}

function bestSpan(center, boundaries, occupied) {
  let best;
  for (let start = 0; start < SLOT_WEIGHTS.length; start += 1) {
    if (start === 4) continue;
    for (let duration = 1; duration <= 3; duration += 1) {
      const end = start + duration;
      if (end > SLOT_WEIGHTS.length || Array.from({ length: duration }, (_, offset) => start + offset).some((slot) => slot === 4 || occupied.has(slot))) break;
      const midpoint = (boundaries[start] + boundaries[end]) / 2;
      const score = Math.abs(midpoint - center) + (duration - 1) * 2;
      if (!best || score < best.score) best = { start, duration, score };
    }
  }
  return best;
}

function combineLines(lines, text) {
  const words = lines.flatMap((line) => line.words || []).sort((left, right) => left.bbox.x0 - right.bbox.x0);
  return {
    text,
    words,
    bbox: {
      x0: Math.min(...lines.map((line) => line.bbox.x0), 0),
      y0: Math.min(...lines.map((line) => line.bbox.y0), 0),
      x1: Math.max(...lines.map((line) => line.bbox.x1), 0),
      y1: Math.max(...lines.map((line) => line.bbox.y1), 0),
    },
  };
}

function extractGridRowsFromOcrData(data) {
  const pageLines = flattenLines(data.blocks);
  const creditHeader = pageLines.find((line) => /\bCredit\b/i.test(line.text) && /Course/i.test(line.text));
  const academicHeader = pageLines.find((line) => /Academic Session/i.test(line.text));
  let dayLines = DAYS.map((day) => pageLines.find((line) => new RegExp(`^${day.slice(0, 3)}`, 'i').test(String(line.text || '').trim())));
  if (dayLines.filter(Boolean).length < 2 && creditHeader) {
    const pageRight = Math.max(...pageLines.map((line) => line.bbox.x1));
    const gridTop = academicHeader
      ? academicHeader.bbox.y1 + (creditHeader.bbox.y0 - academicHeader.bbox.y1) * 0.08
      : creditHeader.bbox.y0 - pageRight * 0.3;
    const gridBottom = creditHeader.bbox.y0 - (creditHeader.bbox.y0 - gridTop) * 0.05;
    const rowHeight = (gridBottom - gridTop) / 6;
    dayLines = DAYS.map((day, index) => {
      const top = gridTop + rowHeight * (index + 1);
      const bottom = top + rowHeight;
      const lines = pageLines.filter((line) => {
        const center = (line.bbox.y0 + line.bbox.y1) / 2;
        return center >= top && center < bottom && line !== creditHeader;
      });
      return lines.length ? combineLines(lines, day) : { text: day, words: [], bbox: { x0: 0, y0: top, x1: 0, y1: bottom } };
    });
  }
  const firstDayLine = dayLines.find(Boolean);
  if (!firstDayLine) return [];
  const pageRight = Math.max(...pageLines.map((line) => line.bbox.x1));
  const dayRight = Math.max(...dayLines.filter(Boolean).flatMap((line) => (
    (line.words || []).filter((word) => /^(?:Mon|Tue|Wed|Thu|Fri)/i.test(word.text)).map((word) => word.bbox.x1)
  )), pageRight * 0.08);
  const headerLine = pageLines
    .filter((line) => (
      line.bbox.y1 < firstDayLine.bbox.y0
      && firstDayLine.bbox.y0 - line.bbox.y1 < 60
      && (line.words || []).length >= 8
    ))
    .at(-1);
  const headerCenters = (headerLine?.words || []).slice(-8).map((word) => (word.bbox.x0 + word.bbox.x1) / 2);
  const fallbackLeft = academicHeader ? pageRight * 0.142 : dayRight + pageRight * 0.02;
  const boundaries = fitSlotBoundaries(headerCenters, fallbackLeft, pageRight);
  const legend = parseLegend(data.text);
  const rows = [];
  dayLines.forEach((line, dayIndex) => {
    if (!line) return;
    const occupied = new Set();
    for (const group of groupScheduleWords(line, boundaries)) {
      const parsed = parseMetadata(group.text, legend);
      if (!parsed) continue;
      const span = bestSpan((group.x0 + group.x1) / 2, boundaries, occupied);
      if (!span) continue;
      for (let slot = span.start; slot < span.start + span.duration; slot += 1) occupied.add(slot);
      rows.push({
        day: DAYS[dayIndex],
        startTime: START_TIMES[span.start],
        endTime: END_TIMES[span.start + span.duration - 1],
        ...parsed,
      });
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
  });

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
    const rows = extractGridRowsFromOcrData(result.data);
    const coordinatorText = await recognizeCoordinatorStrip(worker, buffer, result.data);
    return {
      text: [result.data.text, coordinatorText].filter(Boolean).join('\n'),
      rows,
    };
  } finally {
    activeRecognition = false;
    await worker?.terminate();
  }
}

module.exports = { extractTimetableImage, extractGridRowsFromOcrData, parseLegend, parseMetadata };
