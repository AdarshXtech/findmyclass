const { parseClassroomLocation } = require('./classroom-location');

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const DAY_LOOKUP = new Map(DAYS.flatMap((day, index) => [
  [day.toLowerCase(), index + 1],
  [day.slice(0, 3).toLowerCase(), index + 1],
]));
const CONFLICT_ERROR = 'Time conflict detected';
const DUPLICATE_ERROR = 'Duplicate timetable entry detected for this day and time.';
const ENTRY_TYPES = ['Class', 'Lab', 'Break', 'Lunch Break', 'Free Period', 'Exam', 'Event', 'Library'];
const NO_LOCATION_TYPES = new Set(['Break', 'Lunch Break', 'Free Period']);
const FACULTY_REQUIRED_TYPES = new Set(['Class', 'Lab', 'Lecture', 'Practical']);
const COLLEGE_OPEN = 8 * 60;
const COLLEGE_CLOSE = 18 * 60;
const SUBJECT_ALIASES = new Map([
  ['CAIT', 'Complex Analysis and Integral Transforms'],
  ['DM', 'Discrete Mathematics'],
  ['DSUC', 'Data Structure using C'],
  ['DLD', 'Digital Logic Design'],
  ['AIMES', 'Artificial Intelligence in Mechanical Engineering Systems'],
  ['IS', 'Industrial Sociology'],
  ['BEE', 'Basic Electrical Engineering'],
  ['DS', 'Data Structures'],
  ['EM', 'Engineering Mechanics'],
  ['WORKSHOP', 'Workshop Practices'],
]);

function normalizeSubjectName(value) {
  const subject = String(value || '').trim().replace(/\s+/g, ' ');
  return SUBJECT_ALIASES.get(subject.toUpperCase()) || subject;
}

function normalizeSessionType(value, subjectName = '') {
  const requested = String(value || '').trim();
  const match = [...ENTRY_TYPES, 'Lecture', 'Practical'].find((type) => type.toLowerCase() === requested.toLowerCase());
  if (match) return match;
  const label = `${requested} ${subjectName}`.toLowerCase();
  if (/\b(?:lunch)\b/.test(label)) return 'Lunch Break';
  if (/\b(?:free period|no class)\b/.test(label)) return 'Free Period';
  if (/\b(?:short break|break)\b/.test(label)) return 'Break';
  if (!requested && /\b(?:lab|workshop)\b/.test(label)) return 'Lab';
  return requested || 'Class';
}

function isBreakEntry(value) {
  return NO_LOCATION_TYPES.has(normalizeSessionType(value));
}

function minutesFromTime(value) {
  const [hour, minute] = String(value || '').split(':').map(Number);
  return Number.isFinite(hour) && Number.isFinite(minute) ? hour * 60 + minute : null;
}

function timeFromMinutes(value) {
  return `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;
}

function reviewStatusFor(errors, sessionType) {
  if (errors.some((error) => error.startsWith(CONFLICT_ERROR) || error === DUPLICATE_ERROR)) return 'Conflict';
  if (errors.some((error) => /classroom|room/i.test(error))) return 'Invalid Classroom';
  if (errors.some((error) => /faculty/i.test(error))) return 'Missing Faculty';
  if (errors.some((error) => /subject|title/i.test(error))) return 'Missing Subject';
  if (errors.some((error) => /time/i.test(error))) return 'Missing Time';
  if (errors.length) return 'Needs Review';
  return NO_LOCATION_TYPES.has(sessionType) ? `${sessionType} - No Room Required` : 'Valid';
}

function sanitizeImportText(value) {
  return String(value || '')
    .slice(0, 100000)
    .replace(/\0/g, '')
    .replace(/[^\x09\x0a\x0d\x20-\x7e\u00a0-\uffff]/g, '');
}

function normalizeDay(value) {
  if (Number.isInteger(Number(value)) && Number(value) >= 1 && Number(value) <= DAYS.length) {
    return Number(value);
  }
  return DAY_LOOKUP.get(String(value || '').trim().toLowerCase()) || null;
}

function normalizeTime(value) {
  const input = String(value || '').trim().toUpperCase().replace(/\./g, '');
  const match = input.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?$/);
  if (!match) return null;
  let hour = Number(match[1]);
  const minute = Number(match[2] || 0);
  const meridiem = match[3];
  if (minute > 59 || (meridiem && (hour < 1 || hour > 12)) || (!meridiem && hour > 23)) return null;
  if (meridiem) {
    if (hour === 12) hour = 0;
    if (meridiem === 'PM') hour += 12;
  }
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function formatEntry(row, index = 0) {
  const dayOfWeek = normalizeDay(row.dayOfWeek ?? row.day_of_week ?? row.day);
  const startTime = normalizeTime(row.startTime ?? row.start_time);
  const endTime = normalizeTime(row.endTime ?? row.end_time);
  const requestedSubject = normalizeSubjectName(row.subjectName ?? row.subject_name ?? row.subject);
  const sessionType = normalizeSessionType(row.sessionType ?? row.session_type, requestedSubject);
  const noLocation = NO_LOCATION_TYPES.has(sessionType);
  const subjectName = requestedSubject || (noLocation ? sessionType : sessionType === 'Library' ? 'Library' : '');
  const facultyName = String(row.facultyName ?? row.faculty_name ?? row.teacher ?? '').trim().replace(/\s+/g, ' ');
  const roomInput = String(row.classroom ?? row.room ?? '').trim();
  const external = Boolean(row.external);
  const locationRequired = ['Class', 'Lab', 'Lecture', 'Practical'].includes(sessionType)
    || (sessionType === 'Exam' && !external);
  const parsedLocation = noLocation ? null : parseClassroomLocation(roomInput, { subjectName, sessionType });
  const errors = [];
  if (!dayOfWeek) errors.push('Select a valid day.');
  if (!startTime || !endTime) errors.push('Enter valid start and end times.');
  else if (startTime >= endTime) errors.push('Start time must be before end time.');
  if (!subjectName) errors.push(noLocation ? 'Break title is required.' : 'Subject is required.');
  if (FACULTY_REQUIRED_TYPES.has(sessionType) && !facultyName) errors.push('Faculty is required.');
  if (locationRequired && !parsedLocation?.isValid) errors.push(parsedLocation?.error || 'Classroom is required.');

  const reviewStatus = reviewStatusFor(errors, sessionType);

  return {
    clientId: row.clientId || `row-${index + 1}`,
    timetableEntryId: row.timetableEntryId ?? row.timetable_entry_id ?? null,
    dayOfWeek,
    day: dayOfWeek ? DAYS[dayOfWeek - 1] : String(row.day || ''),
    startTime,
    endTime,
    subjectCode: String(row.subjectCode ?? row.subject_code ?? '').trim(),
    subjectName,
    sessionType,
    facultyCode: String(row.facultyCode ?? row.faculty_code ?? '').trim(),
    facultyName,
    room: noLocation ? '' : parsedLocation?.isValid ? parsedLocation.room : roomInput,
    classroom: noLocation ? '' : roomInput,
    parsedLocation,
    notes: String(row.notes ?? row.note ?? row.description ?? '').trim(),
    external,
    errors,
    reviewStatus,
    status: errors.length ? 'error' : 'valid',
  };
}

function validateRows(inputRows, existingRows = []) {
  const rows = inputRows.map(formatEntry);
  const existing = existingRows.map(formatEntry);
  rows.forEach((row, index) => {
    if (!row.dayOfWeek || !row.startTime || !row.endTime) return;
    const candidates = [
      ...existing.filter((entry) => String(entry.timetableEntryId) !== String(row.timetableEntryId)),
      ...rows.filter((_, candidateIndex) => candidateIndex !== index),
    ];
    const duplicate = candidates.some((entry) => (
      entry.dayOfWeek === row.dayOfWeek
      && entry.startTime === row.startTime
      && entry.endTime === row.endTime
      && entry.subjectName.toLowerCase() === row.subjectName.toLowerCase()
    ));
    const conflict = candidates.find((entry) => (
      entry.dayOfWeek === row.dayOfWeek
      && entry.startTime
      && entry.endTime
      && row.startTime < entry.endTime
      && row.endTime > entry.startTime
    ));
    if (duplicate && !row.errors.includes(DUPLICATE_ERROR)) row.errors.push(DUPLICATE_ERROR);
    else if (conflict) {
      const conflictMessage = `${CONFLICT_ERROR}: "${conflict.subjectName || 'Unnamed subject'}" is scheduled from ${conflict.startTime} to ${conflict.endTime}.`;
      if (!row.errors.includes(conflictMessage)) row.errors.push(conflictMessage);
    }
    row.reviewStatus = reviewStatusFor(row.errors, row.sessionType);
    row.status = row.errors.length ? 'error' : 'valid';
  });
  return rows;
}

function splitTimeRange(value) {
  const match = String(value || '').match(
    /(\d{1,2}(?::\d{2})?\s*(?:AM|PM)?)\s*(?:-|–|—|TO)\s*(\d{1,2}(?::\d{2})?\s*(?:AM|PM)?)/i
  );
  if (!match) return [null, null];
  const timetableTime = (part) => {
    const normalized = normalizeTime(part);
    if (!normalized || /\b(?:AM|PM)\b/i.test(part)) return normalized;
    const [hour, minute] = normalized.split(':').map(Number);
    return hour >= 1 && hour <= 7 ? timeFromMinutes((hour + 12) * 60 + minute) : normalized;
  };
  return [timetableTime(match[1]), timetableTime(match[2])];
}

function matrixCell(value, startTime, endTime) {
  const text = String(value || '').trim();
  if (!text) return null;
  if (startTime === '13:00' && /^(?:L|U|N|C|H|LUNCH(?:\s+BREAK)?)$/i.test(text)) {
    return { startTime, endTime, subject: 'Lunch Break', sessionType: 'Lunch Break' };
  }
  if (/^(?:LIB|LIBRARY)$/i.test(text)) {
    return { startTime, endTime, subject: 'Library', sessionType: 'Library' };
  }

  const parts = text.split('/').map((part) => part.trim()).filter(Boolean);
  const typeCode = /^(?:L|P)$/i.test(parts[0]) ? parts.shift().toUpperCase() : 'L';
  const room = parts.length > 2 ? parts.pop() : '';
  const faculty = parts.length > 1 ? parts.pop() : '';
  const subjectCode = parts.join('/') || text;
  const subject = typeCode === 'P' && subjectCode.toUpperCase() === 'DS'
    ? 'Data Structure Lab'
    : typeCode === 'P' && subjectCode.toUpperCase() === 'DLD'
      ? 'Digital Logic Design Lab'
      : subjectCode;
  return {
    startTime,
    endTime,
    subject,
    teacher: faculty,
    classroom: room,
    sessionType: typeCode === 'P' ? 'Practical' : 'Lecture',
  };
}

function parseTimetableMatrix(text) {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length < 2) return [];
  const delimiter = lines[0].includes('|') ? '|' : lines[0].includes('\t') ? '\t' : null;
  if (!delimiter) return [];

  const headers = lines[0].split(delimiter).map((cell) => cell.trim());
  const slots = headers.slice(1).map(splitTimeRange);
  if (slots.filter(([start, end]) => start && end).length < 2) return [];

  const rows = [];
  for (const line of lines.slice(1)) {
    const cells = line.split(delimiter).map((cell) => cell.trim());
    const dayOfWeek = normalizeDay(cells[0]);
    if (!dayOfWeek) continue;
    for (let index = 0; index < slots.length; index += 1) {
      const [startTime, slotEnd] = slots[index];
      if (!startTime || !slotEnd || !cells[index + 1]) continue;
      let endTime = slotEnd;
      if (/^P\//i.test(cells[index + 1])) {
        let next = index + 1;
        while (next < slots.length && !cells[next + 1] && slots[next][1]) {
          endTime = slots[next][1];
          next += 1;
        }
      }
      const entry = matrixCell(cells[index + 1], startTime, endTime);
      if (entry) rows.push({ day: DAYS[dayOfWeek - 1], ...entry });
    }
  }
  return rows;
}

function parseDelimited(text) {
  const lines = text.split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !/\bclass\s+co(?:[\s-]?o)?rdinator\b/i.test(line));
  if (lines.length < 2) return [];
  const delimiter = lines[0].includes('|') ? '|' : lines[0].includes('\t') ? '\t' : ',';
  const headers = lines[0].split(delimiter).map((cell) => cell.trim().toLowerCase());
  if (!headers.some((header) => header.includes('day')) || !headers.some((header) => header.includes('subject'))) return [];
  const find = (...names) => headers.findIndex((header) => names.some((name) => header.includes(name)));
  const indexes = {
    day: find('day'),
    time: find('time'),
    start: find('start'),
    end: find('end'),
    subject: find('subject', 'course name'),
    teacher: find('teacher', 'faculty'),
    room: find('room', 'classroom', 'location'),
    type: find('type', 'session'),
  };
  return lines.slice(1).map((line) => {
    const cells = line.split(delimiter).map((cell) => cell.trim());
    const [rangeStart, rangeEnd] = splitTimeRange(cells[indexes.time]);
    const subject = cells[indexes.subject];
    return {
      day: cells[indexes.day],
      startTime: indexes.start >= 0 ? cells[indexes.start] : rangeStart,
      endTime: indexes.end >= 0 ? cells[indexes.end] : rangeEnd,
      subject,
      teacher: cells[indexes.teacher],
      classroom: cells[indexes.room],
      sessionType: indexes.type >= 0 ? cells[indexes.type] : /\b(?:lunch|break)\b/i.test(subject || '') ? 'Break' : 'Lecture',
    };
  });
}

function parsePlainText(text) {
  const rows = [];
  let currentDay = '';
  for (const line of text.split(/\r?\n/).map((value) => value.trim()).filter(Boolean)) {
    if (/\bclass\s+co(?:[\s-]?o)?rdinator\b/i.test(line)) continue;
    const day = normalizeDay(line);
    if (day && !/\d/.test(line)) {
      currentDay = DAYS[day - 1];
      continue;
    }
    const range = line.match(/(\d{1,2}(?::\d{2})?\s*(?:AM|PM)?)\s*(?:-|–|—|TO)\s*(\d{1,2}(?::\d{2})?\s*(?:AM|PM)?)/i);
    if (!range) continue;
    const prefix = line.slice(0, range.index).trim();
    const explicitDay = normalizeDay(prefix);
    const remainder = line.slice(range.index + range[0].length).trim();
    const roomMatch = remainder.match(/\b([LU]GF[\s-]?\d{3}|[1-5]\d{2}|CENTRAL\s+LIBRARY|CENTRAL\s+INSTRUMENT\s+LAB)\s*$/i);
    const room = roomMatch?.[1] || '';
    const details = roomMatch ? remainder.slice(0, roomMatch.index).trim() : remainder;
    const teacherMatch = details.match(/\b((?:DR|MR|MRS|MS|PROF)\.?\s+.+)$/i);
    rows.push({
      day: explicitDay ? DAYS[explicitDay - 1] : currentDay,
      startTime: range[1],
      endTime: range[2],
      subject: teacherMatch ? details.slice(0, teacherMatch.index).trim() : details,
      teacher: teacherMatch?.[1] || '',
      classroom: room,
      sessionType: /\b(?:lunch|break)\b/i.test(details) ? 'Break' : 'Lecture',
    });
  }
  return rows;
}

function parseTimetableText(value) {
  const text = sanitizeImportText(value);
  const matrix = parseTimetableMatrix(text);
  if (matrix.length) return validateRows(matrix);
  const parsed = parseDelimited(text);
  const rows = parsed.length ? parsed : parsePlainText(text);
  return validateRows(rows);
}

function parseTimetableCoordinator(value) {
  const text = sanitizeImportText(value);
  const label = /\bclass\s+co(?:[\s-]?o)?rdinator\b\s*[:\-]?\s*/i;
  const match = label.exec(text);
  if (!match) return null;

  const details = text.slice(match.index + match[0].length, match.index + match[0].length + 180);
  const contactLabel = /\b(?:mobile|phone|contact)(?:\s*(?:no|number))?\.?\s*[:\-]?/i;
  const contactMatch = contactLabel.exec(details);
  const nameSource = (contactMatch ? details.slice(0, contactMatch.index) : details.split(/\r?\n/)[0])
    .replace(/[|;,]+$/g, '')
    .trim();
  const name = nameSource.match(/^[A-Za-z][A-Za-z .'-]{1,79}/)?.[0]?.trim() || '';
  const phoneSource = contactMatch ? details.slice(contactMatch.index + contactMatch[0].length, contactMatch.index + contactMatch[0].length + 40) : '';
  const phoneMatch = phoneSource.match(/(?:\+?91[\s-]?)?((?:\d[\s-]?){10})(?!\d)/)?.[0] || '';
  const digits = phoneMatch.replace(/\D/g, '');
  const phoneNumber = digits.length === 12 && digits.startsWith('91') ? digits.slice(2) : digits;

  return name ? { name, phoneNumber } : null;
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

function matchCoordinatorToFaculty(coordinator, rows) {
  if (!coordinator?.name) return coordinator;
  const target = coordinator.name.toUpperCase().replace(/[^A-Z]/g, '');
  let closest = null;
  let distance = 3;
  for (const row of rows) {
    const name = String(row.facultyName || '').trim();
    const candidateDistance = editDistance(target, name.toUpperCase().replace(/[^A-Z]/g, ''));
    if (name && candidateDistance < distance) {
      closest = name;
      distance = candidateDistance;
    }
  }
  return closest ? { ...coordinator, name: closest } : coordinator;
}

function shiftRows(inputRows, { direction = 'later', minutes = 0 } = {}, existingRows = []) {
  const amount = Number(minutes);
  if (!Number.isInteger(amount) || amount < 1 || amount > 240) {
    return validateRows(inputRows).map((row) => ({
      ...row,
      errors: [...row.errors, 'Shift amount must be between 1 and 240 minutes.'],
      reviewStatus: 'Needs Review',
      status: 'error',
    }));
  }
  const offset = direction === 'earlier' ? -amount : amount;
  const shifted = inputRows.map((row) => {
    const start = minutesFromTime(normalizeTime(row.startTime ?? row.start_time));
    const end = minutesFromTime(normalizeTime(row.endTime ?? row.end_time));
    return {
      ...row,
      startTime: start === null ? row.startTime : timeFromMinutes(start + offset),
      endTime: end === null ? row.endTime : timeFromMinutes(end + offset),
    };
  });
  const validated = validateRows(shifted, existingRows);
  validated.forEach((row) => {
    const start = minutesFromTime(row.startTime);
    const end = minutesFromTime(row.endTime);
    if (start < COLLEGE_OPEN || end > COLLEGE_CLOSE) {
      row.errors.push('Shifted entries must stay between 8:00 AM and 6:00 PM.');
      row.reviewStatus = 'Needs Review';
      row.status = 'error';
    }
  });
  return validated;
}

module.exports = {
  CONFLICT_ERROR,
  DAYS,
  DUPLICATE_ERROR,
  ENTRY_TYPES,
  formatEntry,
  isBreakEntry,
  matchCoordinatorToFaculty,
  normalizeDay,
  normalizeSessionType,
  normalizeTime,
  parseTimetableCoordinator,
  parseTimetableText,
  sanitizeImportText,
  shiftRows,
  validateRows,
};
