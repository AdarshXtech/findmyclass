const EARTH_RADIUS_METERS = 6371000

function radians(value) {
  return value * Math.PI / 180
}

export function distanceMeters(a, b) {
  const latitudeDelta = radians(b[0] - a[0])
  const longitudeDelta = radians(b[1] - a[1])
  const latitudeA = radians(a[0])
  const latitudeB = radians(b[0])
  const haversine = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(latitudeA) * Math.cos(latitudeB) * Math.sin(longitudeDelta / 2) ** 2
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(haversine))
}

export function bearingDegrees(a, b) {
  const latitudeA = radians(a[0])
  const latitudeB = radians(b[0])
  const longitudeDelta = radians(b[1] - a[1])
  const y = Math.sin(longitudeDelta) * Math.cos(latitudeB)
  const x = Math.cos(latitudeA) * Math.sin(latitudeB)
    - Math.sin(latitudeA) * Math.cos(latitudeB) * Math.cos(longitudeDelta)
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360
}

function nearbyNodes(coordinates, nodes, maximumDistance) {
  return nodes
    .map((node) => ({ ...node, distance: distanceMeters(coordinates, node.coordinates) }))
    .filter((node) => node.distance <= maximumDistance)
}

function nodeComponents(nodes, edges) {
  const neighbours = new Map(nodes.map((node) => [node.id, []]))
  for (const [from, to] of edges) {
    if (!neighbours.has(from) || !neighbours.has(to)) continue
    neighbours.get(from).push(to)
    neighbours.get(to).push(from)
  }

  const components = new Map()
  for (const node of nodes) {
    if (components.has(node.id)) continue
    const stack = [node.id]
    while (stack.length) {
      const id = stack.pop()
      if (components.has(id)) continue
      components.set(id, node.id)
      stack.push(...neighbours.get(id))
    }
  }
  return components
}

function nearestNodesByComponent(coordinates, nodes, components, maximumDistance) {
  const nearest = new Map()
  for (const node of nearbyNodes(coordinates, nodes, maximumDistance)) {
    const component = components.get(node.id)
    if (!nearest.has(component) || node.distance < nearest.get(component).distance) nearest.set(component, node)
  }
  return nearest
}

export function connectNearbyPathNodes(nodes, edges, maximumDistance = 3) {
  const connected = edges.map((edge) => [...edge])
  const keys = new Set(connected.map(([from, to]) => [from, to].sort().join(':')))

  for (let fromIndex = 0; fromIndex < nodes.length; fromIndex += 1) {
    for (let toIndex = fromIndex + 1; toIndex < nodes.length; toIndex += 1) {
      const from = nodes[fromIndex]
      const to = nodes[toIndex]
      const key = [from.id, to.id].sort().join(':')
      if (keys.has(key) || distanceMeters(from.coordinates, to.coordinates) > maximumDistance) continue
      connected.push([from.id, to.id])
      keys.add(key)
    }
  }

  return connected
}

function shortestNodePath(startId, endId, nodes, edges) {
  const byId = new Map(nodes.map((node) => [node.id, node]))
  const neighbours = new Map(nodes.map((node) => [node.id, []]))
  for (const [from, to] of edges) {
    if (!byId.has(from) || !byId.has(to) || from === to) continue
    const distance = distanceMeters(byId.get(from).coordinates, byId.get(to).coordinates)
    neighbours.get(from).push({ id: to, distance })
    neighbours.get(to).push({ id: from, distance })
  }

  const distances = new Map(nodes.map((node) => [node.id, Infinity]))
  const previous = new Map()
  const remaining = new Set(nodes.map((node) => node.id))
  distances.set(startId, 0)

  while (remaining.size) {
    let current = null
    for (const id of remaining) {
      if (current === null || distances.get(id) < distances.get(current)) current = id
    }
    if (current === endId || distances.get(current) === Infinity) break
    remaining.delete(current)
    for (const neighbour of neighbours.get(current) || []) {
      const candidate = distances.get(current) + neighbour.distance
      if (candidate < distances.get(neighbour.id)) {
        distances.set(neighbour.id, candidate)
        previous.set(neighbour.id, current)
      }
    }
  }

  if (distances.get(endId) === Infinity) return null
  const path = [endId]
  while (path[0] !== startId) path.unshift(previous.get(path[0]))
  return { distance: distances.get(endId), nodes: path.map((id) => byId.get(id)) }
}

function compassDirection(bearing) {
  return ['north', 'northeast', 'east', 'southeast', 'south', 'southwest', 'west', 'northwest'][Math.round(bearing / 45) % 8]
}

function routeSteps(coordinates, destinationName) {
  if (coordinates.length < 2) return []
  const steps = [`Head ${compassDirection(bearingDegrees(coordinates[0], coordinates[1]))}.`]
  for (let index = 1; index < coordinates.length - 1; index += 1) {
    const before = bearingDegrees(coordinates[index - 1], coordinates[index])
    const after = bearingDegrees(coordinates[index], coordinates[index + 1])
    const change = ((after - before + 540) % 360) - 180
    if (Math.abs(change) < 25) continue
    if (Math.abs(change) > 150) steps.push('Turn around and continue on the path.')
    else steps.push(`Turn ${change > 0 ? 'right' : 'left'} and continue on the path.`)
  }
  steps.push(`Arrive at ${destinationName || 'your destination'}.`)
  return steps
}

function directRoute(start, destination) {
  const coordinates = [start.coordinates, destination.coordinates]
  return {
    kind: 'straight',
    distanceMeters: distanceMeters(...coordinates),
    pathCoordinates: coordinates,
    steps: [`Head toward ${destination.name || 'your destination'}.`],
  }
}

export function findCampusRoute(start, destination, nodes, edges, maximumSnapDistance = 60) {
  if (!start?.coordinates || !destination?.coordinates) return null
  const components = nodeComponents(nodes, edges)
  const startNodes = nearestNodesByComponent(start.coordinates, nodes, components, maximumSnapDistance)
  const destinationNodes = nearestNodesByComponent(destination.coordinates, nodes, components, maximumSnapDistance)
  let best = null

  for (const [component, startNode] of startNodes) {
    const destinationNode = destinationNodes.get(component)
    if (!destinationNode) continue
    const path = shortestNodePath(startNode.id, destinationNode.id, nodes, edges)
    if (!path) continue
    const distance = startNode.distance + path.distance + destinationNode.distance
    if (!best || distance < best.distance) best = { path, distance }
  }

  if (!best) return directRoute(start, destination)
  const pathCoordinates = [
    start.coordinates,
    ...best.path.nodes.map((node) => node.coordinates),
    destination.coordinates,
  ].filter((coordinates, index, all) => index === 0 || coordinates.join() !== all[index - 1].join())

  return {
    kind: 'network',
    distanceMeters: best.distance,
    pathCoordinates,
    steps: routeSteps(pathCoordinates, destination.name),
  }
}

export function serializeCampusPaths(nodes, edges) {
  const connectedEdges = connectNearbyPathNodes(nodes, edges)
  return `// Surveyed pedestrian paths generated by the campus Path Editor.\nexport const CAMPUS_PATH_NODES = ${JSON.stringify(nodes, null, 2)}\n\nexport const CAMPUS_PATH_EDGES = ${JSON.stringify(connectedEdges, null, 2)}\n`
}
