export const CAMPUS_CENTER = [26.88568, 81.05817]
export const CAMPUS_BOUNDS = [
  [26.8819871, 81.0562873],
  [26.8893745, 81.0600424],
]
export const UNIVERSITY_BUILDING_COORDINATES = [26.8889230728831, 81.05898180972179]

const VERIFIED_SOURCE = 'OpenStreetMap way 444400159'
const USER_PIN_SOURCE = 'User-provided Google Maps coordinates'

function campusPlace(id, name, category, coordinates, aliases = []) {
  return {
    id,
    name,
    category,
    coordinates,
    coordinatePrecision: 'map pin',
    aliases,
    source: USER_PIN_SOURCE,
  }
}

export const CAMPUS_LOCATIONS = [
  {
    id: 'university-building',
    name: 'BBD University Building',
    category: 'Academic',
    coordinates: UNIVERSITY_BUILDING_COORDINATES,
    coordinatePrecision: 'building footprint',
    aliases: ['Babu Banarasi Das University', 'Engineering Block', 'Administration', 'Exam Cell'],
    source: VERIFIED_SOURCE,
  },
  {
    id: 'central-library',
    name: 'Central Library',
    category: 'Academic',
    coordinates: UNIVERSITY_BUILDING_COORDINATES,
    coordinatePrecision: 'university building',
    building: 'BBD University Building',
    floor: 'Floor 6',
    wing: 'B',
    aliases: ['Library', '6th Floor', 'Wing B'],
    source: 'BBDU Central Library page and OpenStreetMap university footprint',
  },
  campusPlace('university-main-gate', 'University Main Gate', 'Gate', [26.889244156233268, 81.05881056195926], ['University Gate']),
  campusPlace('campus-main-gate', 'Campus Main Gate', 'Gate', [26.888447617773483, 81.0568836517443], ['Main Gate']),
  campusPlace('itm', 'Accounts Office', 'Services', [26.888008265931433, 81.05680338651463], ['ITM', 'Accounts']),
  campusPlace('student-mall', 'Student Mall', 'Services', [26.887715266549318, 81.05791499211475]),
  campusPlace('bbdca', 'BBDCA', 'Academic', [26.887120391439122, 81.0576341427554]),
  campusPlace('nescafe', 'Nescafe', 'Food', [26.88713161405393, 81.05809180076612], ['Cafe']),
  campusPlace('h-block', 'H-Block', 'Academic', [26.887340648521167, 81.0591164991945], ['H Block']),
  campusPlace('niit-engineering-block', 'NIIT Engineering Block', 'Academic', [26.885930239382844, 81.05879572183387], ['NIIT']),
  campusPlace('niit-pharmacy-block', 'NIIT Pharmacy Block', 'Academic', [26.88637826359855, 81.05904794116515], ['Pharmacy Block']),
  campusPlace('management-building', 'Management Building (M-block)', 'Academic', [26.88626065175135, 81.05968397474872], ['Management Building', 'M Block']),
  campusPlace('gym', 'Gym', 'Sports', [26.88470725874707, 81.05898406417947], ['Fitness Centre', 'Fitness Center']),
  campusPlace('admission-cell', 'Admission Cell', 'Services', [26.885057017224565, 81.05899091720913], ['Admissions']),
  campusPlace('pnb-bank', 'PNB Bank', 'Services', [26.884982743843732, 81.0578152417004], ['Punjab National Bank', 'ATM']),
  campusPlace('stadium-canteen', 'Stadium Canteen', 'Food', [26.884731373795727, 81.05846081753674], ['Canteen', 'Cafeteria']),
  campusPlace('akhilesh-das-gupta-stadium', 'Dr Akhilesh Das Gupta Stadium', 'Sports', [26.883838047534187, 81.05870427514701], ['Stadium']),
  campusPlace('auditorium', 'Auditorium', 'Events', [26.885305585468828, 81.05888162487366], ['Main Auditorium']),
  campusPlace('nbh-ab-block', 'NBH A and B Block', 'Hostel', [26.882809387925057, 81.0580060432339], ['NBH A Block', 'NBH B Block', 'Boys Hostel']),
  campusPlace('nbh-cd-block', 'NBH C and D Block', 'Hostel', [26.882647126202478, 81.05880828511698], ['NBH C Block', 'NBH D Block', 'Boys Hostel']),
  campusPlace('shail-gupta-girls-hostel', 'Shail Gupta Girls Hostel', 'Hostel', [26.88569033543362, 81.05818211251994]),
  campusPlace('bbd-girls-hostel', 'BBD Girls Hostel', 'Hostel', [26.886054501755783, 81.0582918595996], ['Girls Hostel']),
  campusPlace('vidyavati-girls-hostel', 'Vidyavati Girls Hostel', 'Hostel', [26.88682577052206, 81.05833234279122]),
  campusPlace('justice-dp-gupta-girls-hostel', 'Justice DP Gupta Girls Hostel', 'Hostel', [26.887555445976364, 81.05669755324531]),
  campusPlace('smt-sheila-devi-girls-hostel', 'SMT Sheila Devi Girls Hostel', 'Hostel', [26.887804407868174, 81.05866394924291]),
  campusPlace('dr-nirmala-devi-girls-hostel', 'Dr Nirmala Devi Girls Hostel', 'Hostel', [26.887662055610313, 81.05857327311764]),
  campusPlace('itm-e-block', 'ITM (E-block)', 'Academic', [26.886855097244208, 81.05715172550383], ['ITM E Block', 'E Block']),
  campusPlace('bbd-dental-building', 'BBD Dental Building', 'Academic', [26.888075693742206, 81.05771325349365], ['Dental Building']),
  campusPlace('siddhi-vinayak-mandir', 'Om Shri Siddhi Vinayak Mandir', 'Religious', [26.88849886760024, 81.05722964752437], ['Temple', 'Mandir']),
  { id: 'academic-block-1', name: 'Academic Block I', category: 'Academic', coordinates: null, aliases: ['Academic Block 1'] },
  { id: 'academic-block-2', name: 'Academic Block II', category: 'Academic', coordinates: null, aliases: ['Academic Block 2'] },
  { id: 'parking', name: 'Parking', category: 'Services', coordinates: null, aliases: ['Campus Parking'] },
]

function text(value) {
  return String(value || '').trim()
}

export function searchCampusLocations(query, locations) {
  const term = text(query).toLowerCase()
  if (!term) return []
  return locations.filter((location) => [
    location.name,
    location.category,
    location.building,
    location.floor,
    location.wing && `Wing ${location.wing}`,
    ...(location.aliases || []),
  ].some((value) => text(value).toLowerCase().includes(term)))
}

export function destinationContext(destination) {
  if (!destination) return ''
  return [
    destination.building,
    destination.floor,
    destination.wing && `Wing ${destination.wing}`,
  ].filter(Boolean).join(' · ')
}
