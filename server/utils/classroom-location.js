const CLASSROOM_ERROR = 'Invalid classroom number. Please enter a valid room from the building map.';

const NUMBERED_FLOORS = {
  1: { maximum: 20 },
  2: { maximum: 21 },
  3: { maximum: 21 },
  4: { maximum: 19, specialRooms: { 14: 'Central Instrument Lab' } },
  5: { maximum: 20 },
};

const SPECIAL_LOCATIONS = {
  CENTRALLIBRARY: {
    aliases: ['CENTRALLIBRARY', 'LIB'],
    floor: '6',
    wing: 'B',
    room: null,
    locationName: 'Central Library',
  },
  CENTRALINSTRUMENTLAB: {
    aliases: ['CENTRALINSTRUMENTLAB'],
    floor: '4',
    wing: null,
    room: '414',
    locationName: 'Central Instrument Lab',
  },
};

function invalidLocation(originalClassroom, normalizedClassroom, isMissing = false) {
  return {
    valid: false,
    isValid: false,
    isMissing,
    originalClassroom,
    classroomNumber: normalizedClassroom || null,
    room: normalizedClassroom || null,
    roomPosition: null,
    floor: null,
    floorCode: null,
    floorLabel: null,
    shortFloor: null,
    wing: null,
    locationName: null,
    displayLabel: null,
    shortLabel: null,
    fullDisplay: null,
    shortDisplay: null,
    isSpecialLocation: false,
    error: isMissing ? null : CLASSROOM_ERROR,
  };
}

function wingForPosition(position, floorCode) {
  if (position <= 7) return 'A';
  if (floorCode === 'UGF') return position <= 13 ? 'B' : 'C';
  return position <= 14 ? 'B' : 'C';
}

function validLocation({
  originalClassroom,
  normalizedClassroom,
  floor,
  floorLabel,
  wing,
  room,
  roomPosition,
  locationName = null,
}) {
  const isSpecialLocation = Boolean(locationName);
  const locationParts = [floorLabel, wing ? `Wing ${wing}` : null, locationName || (room ? `Room ${room}` : null)]
    .filter(Boolean);

  return {
    valid: true,
    isValid: true,
    isMissing: false,
    originalClassroom,
    classroomNumber: room,
    room,
    roomPosition,
    floor,
    floorCode: floor,
    floorLabel,
    shortFloor: floor === 'UGF' ? 'UGF' : floorLabel,
    wing,
    locationName,
    displayLabel: locationParts.join(' \u00b7 '),
    shortLabel: locationName || `Room ${room}`,
    fullDisplay: locationParts.join(' \u00b7 '),
    shortDisplay: locationName || `Room ${room}`,
    isSpecialLocation,
    error: null,
  };
}

function parseNamedLocation(originalClassroom, normalizedClassroom) {
  const special = Object.values(SPECIAL_LOCATIONS).find((location) => (
    location.aliases.includes(normalizedClassroom)
  ));
  if (!special) return null;

  return validLocation({
    originalClassroom,
    normalizedClassroom,
    floor: special.floor,
    floorLabel: `Floor ${special.floor}`,
    wing: special.wing,
    room: special.room,
    roomPosition: special.room?.slice(-2) || null,
    locationName: special.locationName,
  });
}

function parseClassroomLocation(value, context = {}) {
  const originalClassroom = value === undefined || value === null ? '' : String(value);
  let normalizedClassroom = originalClassroom.trim().toUpperCase().replace(/[\s-]+/g, '');

  const contextLabel = `${context.subjectName || ''} ${context.sessionType || ''}`
    .trim()
    .toUpperCase();
  if (!normalizedClassroom && /\bLIBRARY\b/.test(contextLabel)) {
    normalizedClassroom = 'CENTRALLIBRARY';
  }

  if (!normalizedClassroom) return invalidLocation(originalClassroom, normalizedClassroom, true);

  const namedLocation = parseNamedLocation(originalClassroom, normalizedClassroom);
  if (namedLocation) return namedLocation;

  const undergroundMatch = normalizedClassroom.match(/^UGF(\d{3})$/);
  if (undergroundMatch) {
    const position = Number(undergroundMatch[1]);
    if (position < 1 || position > 20) {
      return invalidLocation(originalClassroom, normalizedClassroom);
    }

    return validLocation({
      originalClassroom,
      normalizedClassroom,
      floor: 'UGF',
      floorLabel: 'Underground Floor',
      wing: wingForPosition(position, 'UGF'),
      room: normalizedClassroom,
      roomPosition: undergroundMatch[1],
    });
  }

  const numberedMatch = normalizedClassroom.match(/^([1-9])(\d{2})$/);
  if (!numberedMatch) return invalidLocation(originalClassroom, normalizedClassroom);

  const floor = numberedMatch[1];
  const position = Number(numberedMatch[2]);
  const mapping = NUMBERED_FLOORS[floor];
  if (!mapping || position < 1 || position > mapping.maximum) {
    return invalidLocation(originalClassroom, normalizedClassroom);
  }

  const locationName = mapping.specialRooms?.[position] || null;
  return validLocation({
    originalClassroom,
    normalizedClassroom,
    floor,
    floorLabel: `Floor ${floor}`,
    wing: locationName ? null : wingForPosition(position, floor),
    room: normalizedClassroom,
    roomPosition: numberedMatch[2],
    locationName,
  });
}

function getClassroomLocationOptions() {
  const options = [];

  for (let position = 1; position <= 20; position += 1) {
    options.push(parseClassroomLocation(`UGF${String(position).padStart(3, '0')}`));
  }

  for (const [floor, mapping] of Object.entries(NUMBERED_FLOORS)) {
    for (let position = 1; position <= mapping.maximum; position += 1) {
      options.push(parseClassroomLocation(`${floor}${String(position).padStart(2, '0')}`));
    }
  }

  options.push(parseClassroomLocation('Central Library'));
  return options;
}

module.exports = {
  CLASSROOM_ERROR,
  getClassroomLocationOptions,
  parseClassroomLocation,
};
