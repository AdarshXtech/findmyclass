function displayFloor(entry) {
  return entry.floorLabel || entry.shortFloor || entry.floor || 'Floor not mapped'
}

export default function LocationHeader({ entry, inline = false, inverted = false }) {
  const floor = displayFloor(entry)
  const wing = entry.wing ? `Wing ${entry.wing}` : null
  const room = entry.classroomNumber || entry.room || entry.originalClassroom || 'Not provided'
  const title = entry.locationName || `Room ${room}`
  const roomLabel = entry.locationName && room !== 'Not provided' ? `Room ${room}` : null
  const secondaryLocation = [floor, wing, roomLabel].filter(Boolean).join(' · ')
  const locationLabel = [title, floor, wing].filter(Boolean).join(', ')

  if (inline) {
    return (
      <div aria-label={locationLabel} className={`min-w-0 border-l-2 pl-4 sm:text-right ${inverted ? 'border-result-blue-pale' : 'border-result-blue-light'}`}>
        <p className={`font-display text-xl font-bold leading-tight [overflow-wrap:anywhere] ${inverted ? 'text-text-on-dark' : 'text-text-primary'}`}>{title}</p>
        <p className={`mt-1 font-mono text-xs font-bold uppercase tracking-wide [overflow-wrap:anywhere] ${inverted ? 'text-result-subtle' : 'text-text-secondary'}`}>{secondaryLocation}</p>
        {entry.locationError ? <p role="alert" className={`mt-2 text-xs font-bold ${inverted ? 'text-text-on-dark' : 'text-status-danger'}`}>{entry.locationError}</p> : null}
      </div>
    )
  }

  return (
    <header aria-label={locationLabel} className="result-location-card min-w-0 rounded-lg bg-surface-inverse px-5 py-5 text-center text-text-on-dark">
      <p className="font-display text-xl font-bold uppercase leading-tight [overflow-wrap:anywhere]">{floor}</p>
      {wing ? <p className="mt-1 font-mono text-xs font-medium uppercase tracking-wide text-result-subtle">{wing}</p> : null}
      <p className="mt-2 min-w-0 font-display text-[2.5rem] font-extrabold uppercase leading-none [overflow-wrap:anywhere] lg:text-[3.5rem]">
        {entry.locationName || `Room ${room}`}
      </p>
      {roomLabel ? <p className="mt-3 font-mono text-xs font-bold uppercase tracking-wide text-result-subtle">{roomLabel}</p> : null}
      {entry.locationError ? <p role="alert" className="mt-4 rounded bg-result-danger-soft px-3 py-2 text-left text-xs font-bold text-result-danger-text">{entry.locationError}</p> : null}
    </header>
  )
}
