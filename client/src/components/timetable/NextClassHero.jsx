import { formatTime } from '../../utils/timetableTime'
import LocationHeader from './LocationHeader'

export default function NextClassHero({ entry, status, finishedForToday, timeContext }) {
  if (!entry) {
    return (
      <section className="rounded-lg border border-border-default bg-surface-primary px-5 py-7" aria-live="polite">
        <p className="font-mono text-xs font-bold uppercase tracking-wide text-accent-primary">Today&apos;s schedule</p>
        <p className="mt-2 font-display text-2xl font-bold">
          {finishedForToday ? 'No more classes today' : 'No classes scheduled today'}
        </p>
        <p className="mt-2 text-sm leading-6 text-text-secondary">Open Weekly Classes to check another day.</p>
      </section>
    )
  }

  const current = status === 'Current class'
  const detailText = current ? 'text-text-on-dark' : 'text-result-slate-dark'
  const mutedText = current ? 'text-text-on-dark' : 'text-result-slate-dark'

  return (
    <section className={`current-class-hero ${current ? 'current-class-hero--current' : 'current-class-hero--next'} min-w-0`} aria-label={`${status} location`} aria-live="polite">
      <div className="current-class-hero__location min-w-0">
        <LocationHeader entry={entry} />
      </div>
      <div className={`current-class-hero__details min-w-0 ${detailText}`}>
        <p className={`font-mono text-xs font-bold uppercase tracking-wide ${current ? mutedText : 'text-accent-primary'}`}>{status}</p>
        <h2 className="mt-2 min-w-0 font-display text-2xl font-bold leading-tight [overflow-wrap:anywhere] lg:text-3xl">
          {entry.subjectName}
        </h2>
        <div className={`mt-3 min-w-0 text-sm leading-6 ${mutedText}`}>
          <p className={`font-semibold ${detailText}`}>{timeContext}</p>
          <p><time>{formatTime(entry.startTime)}</time> &ndash; <time>{formatTime(entry.endTime)}</time></p>
        </div>
        <dl className="mt-6 grid min-w-0 gap-5 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
          <div className="min-w-0">
            <dt className={`font-mono text-xs font-bold uppercase tracking-wide ${mutedText}`}>Type of class</dt>
            <dd className="mt-1 font-bold [overflow-wrap:anywhere]">{entry.sessionType}</dd>
          </div>
          <div className="min-w-0">
            <dt className={`font-mono text-xs font-bold uppercase tracking-wide ${mutedText}`}>Faculty</dt>
            <dd className="mt-1 font-bold [overflow-wrap:anywhere]">{entry.facultyName || 'Faculty not listed'}</dd>
          </div>
        </dl>
      </div>
    </section>
  )
}
