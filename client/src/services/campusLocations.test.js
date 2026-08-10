import { describe, expect, it } from 'vitest'
import { makeEntry } from '../test/fixtures'
import {
  buildTimetableDestinations,
  CAMPUS_LOCATIONS,
  CLASSROOM_LOCATIONS,
  destinationForEntry,
  searchCampusLocations,
} from './campusLocations'

describe('campus locations', () => {
  it('reuses parsed timetable location data for classroom destinations', () => {
    const entry = makeEntry({ classroomNumber: '407', floorLabel: 'Floor 4', wing: 'A' })
    const destinations = buildTimetableDestinations([entry])

    expect(destinationForEntry(entry, destinations)).toMatchObject({
      name: 'Room 407',
      floor: 'Floor 4',
      wing: 'A',
      room: '407',
    })
  })

  it('searches rooms, floors, wings, and subject aliases', () => {
    const destinations = buildTimetableDestinations([
      makeEntry({ classroomNumber: 'LGF001', floorLabel: 'Lower Ground Floor', wing: 'A', subjectName: 'Digital Logic Design Lab' }),
    ])

    expect(searchCampusLocations('LGF001', destinations)).toHaveLength(1)
    expect(searchCampusLocations('lower ground', destinations)).toHaveLength(1)
    expect(searchCampusLocations('digital logic', destinations)).toHaveLength(1)
  })

  it('keeps invalid classroom destinations visible but non-navigable', () => {
    const [destination] = buildTimetableDestinations([
      makeEntry({ classroomNumber: '999', locationError: 'Invalid classroom number.' }),
    ])

    expect(destination.coordinates).toBeNull()
    expect(destination.locationError).toBe('Invalid classroom number.')
  })

  it('includes the surveyed campus destinations', () => {
    expect(searchCampusLocations('Student Mall', CAMPUS_LOCATIONS)[0]?.coordinates)
      .toEqual([26.887715266549318, 81.05791499211475])
    expect(searchCampusLocations('Punjab National Bank', CAMPUS_LOCATIONS)[0]?.name)
      .toBe('PNB Bank')
    expect(CAMPUS_LOCATIONS.filter((location) => location.coordinatePrecision === 'map pin')).toHaveLength(25)
    expect(searchCampusLocations('NIIT Engineering', CAMPUS_LOCATIONS)[0]?.coordinates)
      .toEqual([26.885930239382844, 81.05879572183387])
    expect(searchCampusLocations('M Block', CAMPUS_LOCATIONS)[0]?.name)
      .toBe('Management Building (M-block)')
  })

  it('places Central Library across Wing B on Floor 6', () => {
    expect(searchCampusLocations('Central Library', CAMPUS_LOCATIONS)[0]).toMatchObject({
      floor: 'Floor 6',
      wing: 'B',
    })
  })

  it('makes every confirmed classroom searchable without map-specific room data', () => {
    expect(CLASSROOM_LOCATIONS).toHaveLength(130)
    expect(searchCampusLocations('Room 101', CLASSROOM_LOCATIONS)[0]).toMatchObject({ floor: 'Floor 1', wing: 'A' })
    expect(searchCampusLocations('520', CLASSROOM_LOCATIONS)[0]).toMatchObject({ floor: 'Floor 5', wing: 'C' })
    expect(searchCampusLocations('UGF020', CLASSROOM_LOCATIONS)[0]).toMatchObject({ floor: 'Underground Floor', wing: 'C' })
    expect(searchCampusLocations('LGF009', CLASSROOM_LOCATIONS)[0]).toMatchObject({ floor: 'Lower Ground Floor', wing: 'B' })
  })
})
