import { HiOutlineCalendar } from 'react-icons/hi'
import { WEEKDAYS } from '../../utils/timetableTime'
import DayAccordion from './DayAccordion'
import TimetableEmptyState from './TimetableEmptyState'

export default function WeeklySchedule({
  classrooms,
  entryStatusById,
  expandedDay,
  locationStatus,
  onDayToggle,
  subjectCount,
  teachingEntries,
  timetable,
  timetableByDay,
}) {
  const visibleDays = WEEKDAYS.filter((day) => day.id <= 5)

  return (
    <section className="mt-8 min-w-0 lg:mt-10">
      <div className="mb-5 flex min-w-0 flex-wrap items-end justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <HiOutlineCalendar aria-hidden="true" className="shrink-0 text-2xl text-result-blue" />
          <div className="min-w-0">
            <h2 className="font-display text-2xl font-bold sm:text-3xl">Weekly Classes</h2>
            <p className="mt-1 text-sm text-text-secondary">Monday to Friday</p>
          </div>
        </div>
        {timetable.length ? <p className="text-sm text-text-secondary">{subjectCount} subjects / {teachingEntries.length} sessions</p> : null}
      </div>

      {timetable.length ? (
        <div className="space-y-3">
          {visibleDays.map((day) => (
            <DayAccordion
              key={day.id}
              day={day}
              entries={timetableByDay.get(day.id) || []}
              entryStatusById={entryStatusById}
              expanded={expandedDay === day.id}
              locationStatus={locationStatus}
              onToggle={() => onDayToggle(day.id)}
            />
          ))}
        </div>
      ) : classrooms.length ? (
        <section className="rounded-lg border border-border-default bg-surface-primary py-3">
          {classrooms.map((classroom) => (
            <div key={classroom.id} className="flex min-w-0 flex-wrap justify-between gap-3 border-b border-border-default px-4 py-3 last:border-0">
              <span className="min-w-0 font-bold [overflow-wrap:anywhere]">{classroom.subject}</span>
              <span className="font-mono text-sm font-bold">Room {classroom.room}</span>
            </div>
          ))}
        </section>
      ) : (
        <TimetableEmptyState message="No timetable is available for this section." detail="Contact the department for an updated schedule." />
      )}
    </section>
  )
}
