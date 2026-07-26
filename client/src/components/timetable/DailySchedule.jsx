import { HiOutlineCalendar, HiOutlineChevronDown } from 'react-icons/hi'
import ClassCard from './ClassCard'
import TimetableEmptyState from './TimetableEmptyState'

export default function DailySchedule({
  activeEntry,
  currentTime,
  formattedDate,
  expanded,
  onToggle,
  priorityEntry,
  todayClasses,
  todayEntries,
}) {
  return (
    <section className="mt-10 border-y-2 border-border-strong">
      <button
        type="button"
        onClick={onToggle}
        className={`grid w-full text-left transition-colors sm:grid-cols-[minmax(0,1fr)_180px] ${expanded ? 'bg-accent-highlight' : 'bg-surface-primary hover:bg-surface-muted'}`}
        aria-expanded={expanded}
        aria-controls="today-schedule"
      >
        <span className="flex items-center gap-3 px-4 py-5 sm:px-6">
          <HiOutlineCalendar aria-hidden="true" className="shrink-0 text-2xl text-accent-primary" />
          <span className="min-w-0">
            <span className="block font-display text-2xl font-bold">Today classes</span>
            <span className="mt-1 block font-mono text-xs font-bold text-text-secondary">{formattedDate}</span>
          </span>
        </span>
        <span className="flex items-center justify-between gap-4 border-t border-border-default px-4 py-4 sm:border-l sm:border-t-0 sm:px-6">
          <span className="text-sm font-medium text-text-secondary">
            {todayClasses.length
              ? `${todayClasses.length} ${todayClasses.length === 1 ? 'class' : 'classes'}`
              : 'No classes'}
          </span>
          <HiOutlineChevronDown aria-hidden="true" className={`shrink-0 text-xl transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`} />
        </span>
      </button>

      <div
        id="today-schedule"
        aria-hidden={!expanded}
        className="grid transition-[grid-template-rows] duration-300"
        style={{ gridTemplateRows: expanded ? '1fr' : '0fr' }}
      >
        <div className="overflow-hidden">
          {todayClasses.length ? (
            <div className="divide-y divide-border-default border-t border-border-default bg-surface-primary">
              {todayEntries.map((entry) => (
                <ClassCard
                  key={entry.id}
                  entry={entry}
                  status={
                    entry.id === priorityEntry?.id
                      ? 'priority'
                      : entry.sessionType !== 'Break' && entry.endTime <= currentTime
                        ? 'completed'
                        : 'upcoming'
                  }
                  priorityLabel={entry.id === activeEntry?.id ? 'Current class' : 'Next class'}
                />
              ))}
            </div>
          ) : (
            <TimetableEmptyState
              message="No classes scheduled for today."
              detail="Your weekly timetable is still available from the menu."
            />
          )}
        </div>
      </div>
    </section>
  )
}
