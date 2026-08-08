import { HiOutlineClock } from 'react-icons/hi'
import { formatTime } from '../../utils/timetableTime'
import LocationHeader from './LocationHeader'

function entryLocationLabel(entry) {
  return entry.locationName
    || (entry.classroomNumber ? `room ${entry.classroomNumber}` : 'room not listed')
}

export default function ClassCard({
  entry,
  status = 'upcoming',
  priorityLabel = 'Next class',
  compact = false,
}) {
  if (entry.sessionType === 'Break') {
    return (
      <article className="schedule-card schedule-card--break min-w-0 rounded-lg border border-result-wine-soft bg-result-wine-soft px-4 py-4 sm:px-5">
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 font-mono text-sm font-bold">
            <HiOutlineClock aria-hidden="true" className="shrink-0 text-lg text-accent-primary" />
            <time>{formatTime(entry.startTime)} &ndash; {formatTime(entry.endTime)}</time>
          </div>
          <span className="rounded border border-result-wine px-2 py-1 font-mono text-xs font-bold uppercase text-accent-primary">Break</span>
        </div>
        <p className="mt-3 font-display text-lg font-bold [overflow-wrap:anywhere]">{entry.subjectName || 'Lunch break'}</p>
        <p className="mt-1 text-sm text-text-secondary">No class scheduled</p>
      </article>
    )
  }

  const effectiveStatus = entry.status === 'cancelled' || entry.cancelled ? 'cancelled' : status
  const current = effectiveStatus === 'current'
  const labels = {
    current: 'Current',
    next: priorityLabel || 'Next',
    completed: 'Completed',
    cancelled: 'Cancelled',
    upcoming: 'Upcoming',
  }

  return (
    <article
      className={`schedule-card schedule-card--${effectiveStatus} ${compact ? 'schedule-card--compact' : ''} min-w-0 rounded-lg border px-4 py-4 sm:px-5`}
      aria-label={`${entry.subjectName}, ${entryLocationLabel(entry)}, ${labels[effectiveStatus]}`}
    >
      <div className="schedule-card__time flex min-w-0 items-center gap-2 font-mono text-sm font-bold">
        <HiOutlineClock aria-hidden="true" className="shrink-0 text-lg" />
        <time>{formatTime(entry.startTime)} &ndash; {formatTime(entry.endTime)}</time>
      </div>
      <div className="schedule-card__subject min-w-0">
        <div className="mb-2 flex min-w-0 flex-wrap items-center gap-2">
          <span className="schedule-status-badge rounded border px-2 py-1 font-mono text-xs font-bold uppercase tracking-wide">{labels[effectiveStatus]}</span>
          {entry.sessionType ? <span className={`text-xs font-semibold ${current ? 'text-text-on-dark' : 'text-text-secondary'}`}>{entry.sessionType}</span> : null}
        </div>
        <h3 className="min-w-0 font-display text-lg font-bold leading-snug [overflow-wrap:anywhere]">{entry.subjectName}</h3>
        <p className={`mt-1 min-w-0 text-sm [overflow-wrap:anywhere] ${current ? 'text-text-on-dark' : 'text-text-secondary'}`}>{entry.facultyName || 'Faculty not listed'}</p>
      </div>
      <LocationHeader entry={entry} inline inverted={current} />
    </article>
  )
}
