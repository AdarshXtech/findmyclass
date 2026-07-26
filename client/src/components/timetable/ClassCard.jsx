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
      <article className="grid gap-3 bg-surface-highlight px-4 py-4 sm:grid-cols-[190px_minmax(0,1fr)_160px] sm:items-center sm:px-6">
        <div className="flex items-center gap-2 whitespace-nowrap font-mono text-sm font-bold">
          <HiOutlineClock aria-hidden="true" className="text-lg text-accent-primary" />
          <span>{formatTime(entry.startTime)} &ndash; {formatTime(entry.endTime)}</span>
        </div>
        <p className="font-display text-lg font-bold">Lunch break</p>
        <p className="text-sm font-medium text-status-warning sm:text-right">No class scheduled</p>
      </article>
    )
  }

  const highlighted = status === 'priority'
  const completed = status === 'completed'

  if (compact) {
    return (
      <article
        className="grid min-w-0 gap-3 bg-surface-primary px-4 py-4 md:grid-cols-[180px_minmax(0,1fr)_220px] md:items-center md:gap-6 md:px-6"
        aria-label={`${entry.subjectName}, ${entryLocationLabel(entry)}`}
      >
        <div className="flex items-center gap-2 whitespace-nowrap font-mono text-sm font-bold">
          <HiOutlineClock aria-hidden="true" className="text-lg text-accent-primary" />
          <time>{formatTime(entry.startTime)} &ndash; {formatTime(entry.endTime)}</time>
        </div>
        <div className="min-w-0">
          <div className="mb-1 flex flex-wrap items-center gap-2 text-xs">
            {entry.subjectCode ? <span className="font-mono font-black text-status-success">{entry.subjectCode}</span> : null}
            <span className="text-text-secondary">{entry.sessionType}</span>
          </div>
          <h3 className="font-bold leading-5 [overflow-wrap:anywhere]">{entry.subjectName}</h3>
          <p className="mt-1 text-sm text-text-secondary [overflow-wrap:anywhere]">{entry.facultyName || 'Teacher not listed'}</p>
        </div>
        <LocationHeader entry={entry} compact inline />
      </article>
    )
  }

  return (
    <article
      className="min-w-0 bg-surface-primary"
      aria-label={`${entry.subjectName}, ${entryLocationLabel(entry)}${completed ? ', completed' : ''}`}
    >
      <LocationHeader entry={entry} highlighted={highlighted} />
      <div className="grid gap-4 px-4 py-4 sm:px-5 lg:grid-cols-[minmax(0,1fr)_240px] lg:items-end">
        <div className="min-w-0">
          <div className="mb-1 flex flex-wrap items-center gap-2 text-xs">
            {entry.subjectCode ? <span className="font-mono font-black text-status-success">{entry.subjectCode}</span> : null}
            <span className="text-text-secondary">{entry.sessionType}</span>
            {highlighted ? <span className="bg-accent-primary px-2 py-0.5 font-bold uppercase tracking-wide text-text-on-accent">{priorityLabel}</span> : null}
            {completed ? <span className="border border-border-input px-2 py-0.5 font-bold uppercase tracking-wide text-text-secondary">Completed</span> : null}
          </div>
          <h3 className={`font-bold leading-5 [overflow-wrap:anywhere] ${completed ? 'text-text-secondary' : ''}`}>{entry.subjectName}</h3>
          <p className="mt-1 text-sm text-text-secondary [overflow-wrap:anywhere]">{entry.facultyName || 'Teacher not listed'}</p>
        </div>
        <div className={`flex items-center gap-2 whitespace-nowrap font-mono text-sm font-bold lg:justify-end ${completed ? 'text-text-secondary' : ''}`}>
          <HiOutlineClock aria-hidden="true" className={`text-lg ${completed ? 'text-text-secondary' : 'text-accent-primary'}`} />
          <time>{formatTime(entry.startTime)} &ndash; {formatTime(entry.endTime)}</time>
        </div>
      </div>
    </article>
  )
}
