import { HiOutlineCalendar, HiOutlineChevronDown } from 'react-icons/hi'
import ClassCard from './ClassCard'
import TimetableEmptyState from './TimetableEmptyState'

export default function DailySchedule({
  entryStatusById,
  formattedDate,
  expanded,
  locationStatus,
  onToggle,
  todayClasses,
  todayEntries,
}) {
  return (
    <section className="mt-8 min-w-0 lg:mt-10">
      <button
        type="button"
        onClick={onToggle}
        className={`flex min-h-12 w-full min-w-0 items-center justify-between gap-4 rounded-lg border px-5 py-4 text-left transition-colors ${expanded ? 'border-result-blue bg-result-blue text-text-on-dark' : 'border-border-default bg-surface-primary hover:border-result-blue'}`}
        aria-expanded={expanded}
        aria-controls="today-schedule"
      >
        <span className="flex min-w-0 items-center gap-3">
          <HiOutlineCalendar aria-hidden="true" className="shrink-0 text-xl" />
          <span className="min-w-0">
            <span className="block font-display text-lg font-bold">Other Classes</span>
            <span className={`mt-1 block font-mono text-xs font-medium [overflow-wrap:anywhere] ${expanded ? 'text-result-subtle' : 'text-text-secondary'}`}>{formattedDate}</span>
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-3">
          <span className="text-sm font-semibold">{todayClasses.length}</span>
          <HiOutlineChevronDown aria-hidden="true" className={`text-xl transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`} />
        </span>
      </button>

      <div
        id="today-schedule"
        aria-hidden={!expanded}
        className={`grid transition-[grid-template-rows] duration-200 ${expanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}
      >
        <div className="overflow-hidden">
          <div className="other-classes-scroll mt-4">
            {todayClasses.length ? (
              <div className="schedule-card-grid">
                {todayEntries.map((entry) => (
                  <ClassCard
                    key={entry.id}
                    entry={entry}
                    status={entryStatusById.get(entry.id)}
                    priorityLabel={entryStatusById.get(entry.id) === 'next' ? locationStatus : undefined}
                  />
                ))}
              </div>
            ) : (
              <TimetableEmptyState
                message="No classes scheduled for today."
                detail="Your weekly timetable is still available from Daily and Weekly navigation."
              />
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
