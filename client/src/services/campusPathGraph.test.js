import { describe, expect, it } from 'vitest'
import { connectNearbyPathNodes, findCampusRoute, serializeCampusPaths } from './campusPathGraph'

const nodes = [
  { id: 'n1', coordinates: [26.885, 81.058] },
  { id: 'n2', coordinates: [26.8852, 81.058] },
  { id: 'n3', coordinates: [26.8852, 81.0582] },
]

describe('campus path graph', () => {
  it('uses the shortest connected path and produces local directions', () => {
    const route = findCampusRoute(
      { coordinates: nodes[0].coordinates },
      { name: 'Library', coordinates: nodes[2].coordinates },
      nodes,
      [['n1', 'n2'], ['n2', 'n3']],
    )

    expect(route.kind).toBe('network')
    expect(route.pathCoordinates).toContainEqual(nodes[1].coordinates)
    expect(route.steps.at(-1)).toBe('Arrive at Library.')
  })

  it('falls back to a direct line when either endpoint is outside the graph', () => {
    const route = findCampusRoute(
      { coordinates: [26.88, 81.05] },
      { name: 'Gym', coordinates: nodes[2].coordinates },
      nodes,
      [['n1', 'n2'], ['n2', 'n3']],
    )

    expect(route.kind).toBe('straight')
    expect(route.pathCoordinates).toHaveLength(2)
  })

  it('exports a ready-to-use JavaScript module', () => {
    expect(serializeCampusPaths(nodes, [['n1', 'n2']])).toContain('export const CAMPUS_PATH_EDGES')
  })

  it('connects nearby nodes when separate tracing chains meet', () => {
    const closeNodes = [
      { id: 'a', coordinates: [26.885, 81.058] },
      { id: 'b', coordinates: [26.88501, 81.058] },
    ]

    expect(connectNearbyPathNodes(closeNodes, [])).toEqual([['a', 'b']])
  })
})
