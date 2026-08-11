import { describe, expect, it } from 'vitest'
import {
  CAMPUS_LOCATIONS,
  searchCampusLocations,
} from './campusLocations'

describe('campus locations', () => {
  it('includes the surveyed campus destinations', () => {
    expect(searchCampusLocations('Student Mall', CAMPUS_LOCATIONS)[0]?.coordinates)
      .toEqual([26.887715266549318, 81.05791499211475])
    expect(searchCampusLocations('Punjab National Bank', CAMPUS_LOCATIONS)[0]?.name)
      .toBe('PNB Bank')
    expect(CAMPUS_LOCATIONS.filter((location) => location.coordinatePrecision === 'map pin')).toHaveLength(27)
    expect(searchCampusLocations('NIIT Engineering', CAMPUS_LOCATIONS)[0]?.coordinates)
      .toEqual([26.885930239382844, 81.05879572183387])
    expect(searchCampusLocations('M Block', CAMPUS_LOCATIONS)[0]?.name)
      .toBe('Management Building (M-block)')
    expect(searchCampusLocations('ITM', CAMPUS_LOCATIONS)[0]?.name)
      .toBe('Accounts Office')
    expect(searchCampusLocations('University Main Gate', CAMPUS_LOCATIONS)[0]?.coordinates)
      .toEqual([26.889244156233268, 81.05881056195926])
    expect(searchCampusLocations('Campus Main Gate', CAMPUS_LOCATIONS)[0]?.coordinates)
      .toEqual([26.888447617773483, 81.0568836517443])
    expect(searchCampusLocations('Babu Banarasi Das University', CAMPUS_LOCATIONS)[0]).toMatchObject({
      name: 'BBD University Building',
      coordinates: [26.888826187854953, 81.05900326739307],
    })
  })

  it('places Central Library across Wing B on Floor 6', () => {
    expect(searchCampusLocations('Central Library', CAMPUS_LOCATIONS)[0]).toMatchObject({
      coordinates: [26.888826187854953, 81.05900326739307],
      floor: 'Floor 6',
      wing: 'B',
    })
  })

  it('does not expose classes, rooms, or labs as map destinations', () => {
    expect(searchCampusLocations('classroom', CAMPUS_LOCATIONS)).toEqual([])
    expect(searchCampusLocations('UGF', CAMPUS_LOCATIONS)).toEqual([])
    expect(searchCampusLocations('lab', CAMPUS_LOCATIONS)).toEqual([])
  })
})
