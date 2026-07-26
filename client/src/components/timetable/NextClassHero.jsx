import { formatTime } from '../../utils/timetableTime'
import LocationHeader from './LocationHeader'

export default function NextClassHero({ entry, status, finishedForToday }) {
  if (!entry) {
    return (
      <section className="border border-border-default bg-surface-primary px-4 py-5" aria-live="polite">
        <p className="font-mono text-xs font-black uppercase tracking-wide text-accent-primary">Today&apos;s schedule</p>
        <p className="mt-2 font-display text-xl font-bold">
          {finishedForToday ? 'No more classes today' : 'No classes scheduled today'}
        </p>
        <p className="mt-1 text-sm text-text-secondary">Open Weekly Classes to check another day.</p>
      </section>
    )
  }

  const details = [
    ['Subject', entry.subjectName],
    ['Type of class', entry.sessionType],
    ['Teacher', entry.facultyName || 'Not scheduled'],
  ]

  return (
    <div className="min-w-0">
      <section className="border border-border-default bg-surface-primary" aria-label={`${status} location`}>
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-border-default bg-accent-highlight px-4 py-3">
          <div>
            <p className="font-mono text-xs font-black uppercase tracking-wide text-accent-strong">{status}</p>
            <p className="mt-1 min-w-0 font-bold leading-snug [overflow-wrap:anywhere]">{entry.subjectName}</p>
          </div>
          <p className="font-mono text-xs font-bold">
            Starts at <time>{formatTime(entry.startTime)}</time>
          </p>
        </div>
        <LocationHeader entry={entry} />
      </section>

      <dl className="grid border-x border-b border-border-default bg-surface-muted sm:grid-cols-3">
        {details.map(([label, value], index) => (
          <div key={label} className={`min-w-0 px-3 py-3 ${index < details.length - 1 ? 'max-sm:border-b max-sm:border-border-default sm:border-r sm:border-border-default' : ''}`}>
            <dt className="text-xs font-bold uppercase tracking-wide text-text-secondary">{label}</dt>
            <dd className="mt-1 text-sm font-bold [overflow-wrap:anywhere]" title={String(value)}>{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
