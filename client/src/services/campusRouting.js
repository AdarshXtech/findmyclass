export function getIndoorGuidance(destination) {
  if (!destination?.building) return []
  return [
    `Enter ${destination.building}.`,
    destination.floor ? `Go to ${destination.floor}.` : null,
    destination.wing ? `Continue to Wing ${destination.wing}.` : null,
    destination.room ? `Look for Room ${destination.room}.` : `Follow signs for ${destination.name}.`,
  ].filter(Boolean)
}

export function getGoogleMapsDirectionsUrl(start, destination) {
  if (!destination?.coordinates) return ''
  const params = new URLSearchParams({
    api: '1',
    destination: destination.coordinates.join(','),
    travelmode: 'walking',
    dir_action: 'navigate',
  })
  if (start?.coordinates) params.set('origin', start.coordinates.join(','))
  return `https://www.google.com/maps/dir/?${params}`
}
