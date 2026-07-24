import { HiOutlineLocationMarker } from 'react-icons/hi'

function displayFloor(entry) {
  return entry.shortFloor || entry.floor || 'Not listed'
}

export default function ClassLocationHeader({ entry, compact = false, highlighted = false, inline = false }) {
  if (entry.locationError) {
    return (
      <div className="border-b border-border-default bg-surface-highlight px-4 py-4 sm:px-5">
        <p role="alert" className="font-bold text-status-danger">{entry.locationError}</p>
      </div>
    )
  }

  const floor = displayFloor(entry)
  const wing = entry.wing ? `Wing ${entry.wing}` : 'Not listed'
  const room = entry.classroomNumber || entry.room || 'Not listed'
  const locationLabel = `Room ${room}, ${floor}, ${wing}`

  if (inline) {
    return (
      <div
        aria-label={locationLabel}
        className="min-w-0 md:border-l-2 md:border-accent-highlight md:pl-6 md:text-right"
      >
        <p className="font-display text-xl font-bold leading-tight [overflow-wrap:anywhere]">Room {room}</p>
        <p className="mt-1 font-mono text-xs font-bold uppercase tracking-wide text-text-secondary [overflow-wrap:anywhere]">{floor} &middot; {wing}</p>
      </div>
    )
  }

  return (
    <header
      aria-label={locationLabel}
      className={`grid min-w-0 gap-3 border-b border-border-default px-4 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end sm:px-5 ${
        highlighted ? 'bg-accent-highlight' : 'bg-surface-inverse text-text-on-dark'
      } ${compact ? 'lg:py-3' : ''}`}
    >
      <div className="order-2 flex flex-wrap gap-2 sm:order-1">
        <span className={`border px-2.5 py-1 font-mono text-xs font-black uppercase ${
          highlighted ? 'border-border-strong bg-surface-primary-soft' : 'border-border-inverse bg-surface-primary-subtle'
        }`}>
          {floor}
        </span>
        <span className={`border px-2.5 py-1 font-mono text-xs font-black uppercase ${
          highlighted ? 'border-border-strong bg-surface-primary-soft' : 'border-border-inverse bg-surface-primary-subtle'
        }`}>
          {wing}
        </span>
      </div>
      <div className="order-1 flex min-w-0 items-center gap-2 sm:order-2 sm:justify-end">
        <HiOutlineLocationMarker aria-hidden="true" className={`shrink-0 ${compact ? 'text-2xl' : 'text-3xl'} ${highlighted ? 'text-accent-strong' : 'text-accent-highlight'}`} />
        <div className="min-w-0">
          <span className={`block font-mono text-xs font-black uppercase tracking-wide ${highlighted ? 'text-accent-strong' : 'text-accent-highlight'}`}>
            Room
          </span>
          <span className={`block font-display font-bold leading-none [overflow-wrap:anywhere] ${compact ? 'text-2xl' : 'text-3xl sm:text-4xl'}`}>
            {room}
          </span>
        </div>
      </div>
    </header>
  )
}
