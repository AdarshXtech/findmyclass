const CLASSROOM_ERROR = 'Invalid classroom number. Please enter a valid room from the building map.';
const LGF_ERROR = 'Invalid LGF room. Please use a confirmed LGF room from LGF001 to LGF009.';

const LGF_ROOMS = {
  1: { wing: 'A', locationName: 'DLD Lab', fullLocationName: 'Digital Logic Design Lab' },
  2: { wing: 'A', locationName: 'Basic Electrical Engineering Lab' },
  3: { wing: 'A', locationName: 'Lab 2' },
  4: { wing: 'A', locationName: 'Fluid Mechanics Lab' },
  5: { wing: 'B', locationName: 'Carpentry Shop' },
  6: { wing: 'B', locationName: 'Manufacturing Lab' },
  7: { wing: 'B', locationName: 'Workshop Practices' },
  8: { wing: 'B', locationName: 'Engineering Mechanics Lab' },
  9: {
    wing: 'B',
    locationName: 'Multi-shop Area',
    subLocations: ['Sheet Metal Shop', 'Welding Shop', 'Blacksmith Shop', 'Fitting Shop'],
  },
};

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

function invalidLocation(originalClassroom, normalizedClassroom, isMissing = false, overrides = {}) {
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
    fullLocationName: null,
    subLocations: [],
    displayLabel: null,
    shortLabel: null,
    fullDisplay: null,
    shortDisplay: null,
    isSpecialLocation: false,
    isUnconfirmed: false,
    warning: null,
    error: isMissing ? null : CLASSROOM_ERROR,
    ...overrides,
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
  fullLocationName = locationName,
  subLocations = [],
  includeRoomInDisplay = false,
}) {
  const isSpecialLocation = Boolean(locationName);
  const locationParts = [
    floorLabel,
    wing ? `Wing ${wing}` : null,
    locationName,
    room && (!locationName || includeRoomInDisplay) ? `Room ${room}` : null,
  ]
    .filter(Boolean);
  const fullLocationParts = [
    floorLabel,
    wing ? `Wing ${wing}` : null,
    fullLocationName,
    room && (!fullLocationName || includeRoomInDisplay) ? `Room ${room}` : null,
  ].filter(Boolean);

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
    shortFloor: ['UGF', 'LGF'].includes(floor) ? floor : floorLabel,
    wing,
    locationName,
    fullLocationName,
    subLocations,
    displayLabel: locationParts.join(' \u00b7 '),
    shortLabel: locationName || `Room ${room}`,
    fullDisplay: fullLocationParts.join(' \u00b7 '),
    shortDisplay: locationName || `Room ${room}`,
    isSpecialLocation,
    isUnconfirmed: false,
    warning: null,
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

  if (normalizedClassroom.startsWith('LGF')) {
    const lowerGroundMatch = normalizedClassroom.match(/^LGF(\d{3})$/);
    const position = lowerGroundMatch ? Number(lowerGroundMatch[1]) : null;
    const mapping = LGF_ROOMS[position];
    if (!lowerGroundMatch || !mapping) {
      return invalidLocation(originalClassroom, normalizedClassroom, false, {
        floor: 'LGF',
        floorCode: 'LGF',
        floorLabel: 'Lower Ground Floor',
        shortFloor: 'LGF',
        error: LGF_ERROR,
      });
    }

    return validLocation({
      originalClassroom,
      normalizedClassroom,
      floor: 'LGF',
      floorLabel: 'Lower Ground Floor',
      wing: mapping.wing,
      room: normalizedClassroom,
      roomPosition: lowerGroundMatch[1],
      locationName: mapping.locationName,
      fullLocationName: mapping.fullLocationName || mapping.locationName,
      subLocations: mapping.subLocations || [],
      includeRoomInDisplay: true,
    });
  }

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

  for (let position = 1; position <= 9; position += 1) {
    options.push(parseClassroomLocation(`LGF${String(position).padStart(3, '0')}`));
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
  LGF_ERROR,
  getClassroomLocationOptions,
  parseClassroomLocation,
};
