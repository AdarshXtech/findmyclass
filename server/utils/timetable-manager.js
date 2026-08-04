const { parseClassroomLocation } = require('./classroom-location');

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const DAY_LOOKUP = new Map(DAYS.flatMap((day, index) => [
  [day.toLowerCase(), index + 1],
  [day.slice(0, 3).toLowerCase(), index + 1],
]));
const CONFLICT_ERROR = 'Time conflict detected. This class overlaps with another timetable entry.';
const DUPLICATE_ERROR = 'Duplicate timetable entry detected for this day and time.';

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
  const requestedSessionType = String(row.sessionType ?? row.session_type ?? 'Lecture').trim();
  const sessionType = /^break$/i.test(requestedSessionType) ? 'Break' : requestedSessionType || 'Lecture';
  const isBreak = sessionType === 'Break';
  const subjectName = String(row.subjectName ?? row.subject_name ?? row.subject ?? (isBreak ? 'Lunch break' : '')).trim().replace(/\s+/g, ' ');
  const facultyName = String(row.facultyName ?? row.faculty_name ?? row.teacher ?? '').trim().replace(/\s+/g, ' ');
  const roomInput = String(row.classroom ?? row.room ?? '').trim();
  const parsedLocation = parseClassroomLocation(roomInput, { subjectName, sessionType });
  const errors = [];
  if (!dayOfWeek) errors.push('Select a valid day.');
  if (!startTime || !endTime) errors.push('Enter valid start and end times.');
  else if (startTime >= endTime) errors.push('Start time must be before end time.');
  if (!subjectName) errors.push('Subject is required.');
  if (!isBreak && !facultyName) errors.push('Teacher is required.');
  if (!isBreak && !parsedLocation.isValid) errors.push(parsedLocation.error || 'Classroom is required.');

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
    room: isBreak ? '' : parsedLocation.isValid ? parsedLocation.room : roomInput,
    classroom: roomInput,
    parsedLocation,
    errors,
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
    const conflict = candidates.some((entry) => (
      entry.dayOfWeek === row.dayOfWeek
      && entry.startTime
      && entry.endTime
      && row.startTime < entry.endTime
      && row.endTime > entry.startTime
    ));
    if (duplicate && !row.errors.includes(DUPLICATE_ERROR)) row.errors.push(DUPLICATE_ERROR);
    else if (conflict && !row.errors.includes(CONFLICT_ERROR)) row.errors.push(CONFLICT_ERROR);
    row.status = row.errors.length ? 'error' : 'valid';
  });
  return rows;
}

function splitTimeRange(value) {
  const match = String(value || '').match(
    /(\d{1,2}(?::\d{2})?\s*(?:AM|PM)?)\s*(?:-|–|—|TO)\s*(\d{1,2}(?::\d{2})?\s*(?:AM|PM)?)/i
  );
  return match ? [normalizeTime(match[1]), normalizeTime(match[2])] : [null, null];
}

function parseDelimited(text) {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
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
  const parsed = parseDelimited(text);
  const rows = parsed.length ? parsed : parsePlainText(text);
  return validateRows(rows);
}

module.exports = {
  CONFLICT_ERROR,
  DAYS,
  DUPLICATE_ERROR,
  formatEntry,
  normalizeDay,
  normalizeTime,
  parseTimetableText,
  sanitizeImportText,
  validateRows,
};
