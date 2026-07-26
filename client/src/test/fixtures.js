export function makeEntry(overrides = {}) {
  return {
    id: 1,
    dayOfWeek: 1,
    startTime: '09:00',
    endTime: '10:00',
    subjectCode: 'NCS4303',
    subjectName: 'Digital Logic Design',
    sessionType: 'Lecture',
    facultyName: 'Mr. Vivek Singh',
    classroomNumber: '407',
    floor: 'Floor 4',
    wing: 'A',
    academicSession: '2026-27',
    ...overrides,
  }
}

export function makeLookupData(overrides = {}) {
  return {
    student: {
      name: 'Rudransh Kumar Singh',
      course: 'B.Tech CSAI',
      year: 'Year 2',
      section: 'CSAI2B',
      classRollNumber: '42',
      phoneNumber: '8429479825',
    },
    classrooms: [],
    timetable: [makeEntry()],
    ...overrides,
  }
}

export function setViewport(width, height = 800) {
  Object.defineProperty(window, 'innerWidth', {
    configurable: true,
    value: width,
  })
  Object.defineProperty(window, 'innerHeight', {
    configurable: true,
    value: height,
  })
  window.dispatchEvent(new Event('resize'))
}
