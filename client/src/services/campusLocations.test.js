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
    expect(CAMPUS_LOCATIONS.filter((location) => location.coordinatePrecision === 'map pin')).toHaveLength(25)
    expect(searchCampusLocations('NIIT Engineering', CAMPUS_LOCATIONS)[0]?.coordinates)
      .toEqual([26.885930239382844, 81.05879572183387])
    expect(searchCampusLocations('M Block', CAMPUS_LOCATIONS)[0]?.name)
      .toBe('Management Building (M-block)')
    expect(searchCampusLocations('ITM', CAMPUS_LOCATIONS)[0]?.name)
      .toBe('Accounts Office')
  })

  it('places Central Library across Wing B on Floor 6', () => {
    expect(searchCampusLocations('Central Library', CAMPUS_LOCATIONS)[0]).toMatchObject({
      coordinates: [26.88885787946639, 81.05900840676333],
      floor: 'Floor 6',
      wing: 'B',
    })
  })
})
