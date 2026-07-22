const CLASSROOM_ERROR = 'Invalid classroom number. Use UGF, LGF, or floors 1 to 8, with a room position between 01 and 21.';

function invalidLocation(originalClassroom, normalizedClassroom, isMissing = false) {
  return {
    valid: false,
    isMissing,
    originalClassroom,
    classroomNumber: normalizedClassroom || null,
    roomPosition: null,
    floor: null,
    floorCode: null,
    shortFloor: null,
    wing: null,
    fullDisplay: null,
    shortDisplay: null,
    error: isMissing ? null : CLASSROOM_ERROR,
  };
}

function parseClassroomLocation(value) {
  const originalClassroom = value === undefined || value === null ? '' : String(value);
  const normalizedClassroom = originalClassroom.trim().toUpperCase().replace(/[\s-]+/g, '');

  if (!normalizedClassroom) return invalidLocation(originalClassroom, normalizedClassroom, true);

  const specialMatch = normalizedClassroom.match(/^(UGF|LGF)(\d{2})$/);
  const numberedMatch = normalizedClassroom.match(/^([1-8])(\d{2})$/);

  if (!specialMatch && !numberedMatch) {
    return invalidLocation(originalClassroom, normalizedClassroom);
  }

  const floorCode = specialMatch?.[1] || numberedMatch[1];
  const roomPosition = specialMatch?.[2] || numberedMatch[2];
  const position = Number(roomPosition);

  if (position < 1 || position > 21) {
    return invalidLocation(originalClassroom, normalizedClassroom);
  }

  const wing = position <= 7 ? 'A' : position <= 14 ? 'B' : 'C';
  const floor = floorCode === 'UGF'
    ? 'Upper Ground Floor'
    : floorCode === 'LGF'
      ? 'Lower Ground Floor'
      : `Floor ${floorCode}`;
  const shortFloor = floorCode === 'UGF' || floorCode === 'LGF' ? floorCode : `Floor ${floorCode}`;

  return {
    valid: true,
    isMissing: false,
    originalClassroom,
    classroomNumber: normalizedClassroom,
    roomPosition,
    floor,
    floorCode,
    shortFloor,
    wing,
    fullDisplay: `${floor} \u00b7 Wing ${wing} \u00b7 Classroom ${normalizedClassroom}`,
    shortDisplay: `${shortFloor} \u00b7 Wing ${wing} \u00b7 Room ${roomPosition}`,
    error: null,
  };
}

module.exports = { CLASSROOM_ERROR, parseClassroomLocation };
