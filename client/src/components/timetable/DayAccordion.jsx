import { HiOutlineChevronDown } from 'react-icons/hi'
import ClassCard from './ClassCard'

export default function DayAccordion({ day, entries, entryStatusById, expanded, locationStatus, onToggle }) {
  const classCount = entries.filter((entry) => entry.sessionType !== 'Break').length

  return (
    <section className="min-w-0 overflow-hidden rounded-lg border border-border-default bg-surface-primary">
      <button
        type="button"
        onClick={onToggle}
        className={`flex min-h-14 w-full min-w-0 items-center justify-between gap-4 px-4 py-4 text-left transition-colors sm:px-5 ${expanded ? 'bg-result-blue-pale' : 'hover:bg-surface-secondary'}`}
        aria-expanded={expanded}
        aria-controls={`day-${day.id}`}
      >
        <span className="min-w-0">
          <span className="font-mono text-xs font-bold uppercase tracking-wide text-accent-primary">{day.shortName}</span>
          <span className="ml-3 font-display text-lg font-bold">{day.name}</span>
        </span>
        <span className="flex shrink-0 items-center gap-3">
          <span className="text-sm font-medium text-text-secondary">{classCount ? `${classCount} ${classCount === 1 ? 'class' : 'classes'}` : 'No classes'}</span>
          <HiOutlineChevronDown aria-hidden="true" className={`text-xl transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`} />
        </span>
      </button>

      <div id={`day-${day.id}`} aria-hidden={!expanded} className={`grid transition-[grid-template-rows] duration-200 ${expanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
        <div className="overflow-hidden">
          {entries.length ? (
            <div className="schedule-card-grid border-t border-border-default bg-surface-secondary p-3 sm:p-4">
              {entries.map((entry) => (
                <ClassCard
                  key={entry.id}
                  entry={entry}
                  status={entryStatusById.get(entry.id)}
                  priorityLabel={entryStatusById.get(entry.id) === 'next' ? locationStatus : undefined}
                  compact
                />
              ))}
            </div>
          ) : (
            <div className="border-t border-border-default px-5 py-7">
              <p className="font-display text-lg font-bold text-text-secondary">No classes scheduled.</p>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
