import { HiOutlineLocationMarker } from 'react-icons/hi'

function displayFloor(entry) {
  return entry.shortFloor || entry.floor || 'Not listed'
}

export default function ClassLocationHeader({ entry, compact = false, highlighted = false }) {
  if (entry.locationError) {
    return (
      <div className="border-b border-[#20211e]/25 bg-[#f3dfaa] px-4 py-4 sm:px-5">
        <p role="alert" className="font-bold text-[#842d22]">{entry.locationError}</p>
      </div>
    )
  }

  const floor = displayFloor(entry)
  const wing = entry.wing ? `Wing ${entry.wing}` : 'Not listed'
  const room = entry.classroomNumber || entry.room || 'Not listed'
  const locationLabel = `Room ${room}, ${floor}, ${wing}`

  return (
    <header
      aria-label={locationLabel}
      className={`grid gap-3 border-b border-[#20211e]/30 px-4 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end sm:px-5 ${
        highlighted ? 'bg-[#e6b845]' : 'bg-[#20211e] text-[#fffdf7]'
      } ${compact ? 'lg:py-3' : ''}`}
    >
      <div className="order-2 flex flex-wrap gap-2 sm:order-1">
        <span className={`border px-2.5 py-1 font-mono text-xs font-black uppercase ${
          highlighted ? 'border-[#20211e]/45 bg-[#fffdf7]/55' : 'border-[#fffdf7]/35 bg-[#fffdf7]/10'
        }`}>
          {floor}
        </span>
        <span className={`border px-2.5 py-1 font-mono text-xs font-black uppercase ${
          highlighted ? 'border-[#20211e]/45 bg-[#fffdf7]/55' : 'border-[#fffdf7]/35 bg-[#fffdf7]/10'
        }`}>
          {wing}
        </span>
      </div>
      <div className="order-1 flex min-w-0 items-center gap-2 sm:order-2 sm:justify-end">
        <HiOutlineLocationMarker aria-hidden="true" className={`shrink-0 ${compact ? 'text-2xl' : 'text-3xl'} ${highlighted ? 'text-[#842d22]' : 'text-[#e6b845]'}`} />
        <div className="min-w-0">
          <span className={`block font-mono text-[10px] font-black uppercase ${highlighted ? 'text-[#6b321f]' : 'text-[#e6b845]'}`}>
            Room
          </span>
          <span className={`block break-words font-display font-bold leading-none ${compact ? 'text-2xl' : 'text-3xl sm:text-4xl'}`}>
            {room}
          </span>
        </div>
      </div>
    </header>
  )
}
