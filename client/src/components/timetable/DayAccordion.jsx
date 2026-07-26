import { HiOutlineChevronDown } from 'react-icons/hi'
import ClassCard from './ClassCard'

export default function DayAccordion({ day, entries, expanded, onToggle }) {
  const classCount = entries.filter((entry) => entry.sessionType !== 'Break').length

  return (
    <section className="border-b border-border-default">
      <button
        type="button"
        onClick={onToggle}
        className={`grid w-full text-left transition-colors md:grid-cols-[150px_minmax(0,1fr)] ${expanded ? 'bg-accent-highlight' : 'bg-surface-primary hover:bg-surface-muted'}`}
        aria-expanded={expanded}
        aria-controls={`day-${day.id}`}
      >
        <span className="flex items-baseline justify-between px-4 py-4 md:block md:bg-accent-highlight md:py-5">
          <span className="font-mono text-xs font-black">{day.shortName}</span>
          <span className="mt-1 block font-display text-xl font-bold">{day.name}</span>
        </span>
        <span className="flex items-center justify-between gap-4 px-4 py-4 md:px-6">
          <span className="text-sm font-medium text-text-secondary">
            {classCount ? `${classCount} ${classCount === 1 ? 'class' : 'classes'}` : 'No classes'}
          </span>
          <HiOutlineChevronDown aria-hidden="true" className={`text-xl transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`} />
        </span>
      </button>

      <div
        id={`day-${day.id}`}
        aria-hidden={!expanded}
        className="grid transition-[grid-template-rows] duration-300"
        style={{ gridTemplateRows: expanded ? '1fr' : '0fr' }}
      >
        <div className="overflow-hidden">
          {classCount ? (
            <div className="divide-y divide-border-default bg-surface-primary">
              {entries.map((entry) => (
                <ClassCard key={entry.id} entry={entry} compact />
              ))}
            </div>
          ) : (
            <div className="bg-surface-primary px-6 py-8">
              <p className="font-display text-xl font-bold text-text-secondary">No classes scheduled.</p>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
