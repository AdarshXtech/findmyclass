import { HiOutlineCalendar } from 'react-icons/hi'
import { WEEKDAYS } from '../../utils/timetableTime'
import DayAccordion from './DayAccordion'
import TimetableEmptyState from './TimetableEmptyState'

export default function WeeklySchedule({
  classrooms,
  expandedDay,
  onDayToggle,
  subjectCount,
  teachingEntries,
  timetable,
  timetableByDay,
}) {
  return (
    <section>
      <div className="mb-7 mt-10 flex flex-wrap items-baseline justify-between gap-3">
        <div className="flex items-center gap-3">
          <HiOutlineCalendar aria-hidden="true" className="text-2xl text-accent-primary" />
          <h2 className="font-display text-3xl font-bold">Weekly classes</h2>
        </div>
        {timetable.length ? (
          <p className="text-sm text-text-secondary">
            {subjectCount} subjects / {teachingEntries.length} sessions
          </p>
        ) : null}
      </div>

      {timetable.length ? (
        <div className="border-t-2 border-border-strong">
          {WEEKDAYS.map((day) => (
            <DayAccordion
              key={day.id}
              day={day}
              entries={timetableByDay.get(day.id) || []}
              expanded={expandedDay === day.id}
              onToggle={() => onDayToggle(day.id)}
            />
          ))}
        </div>
      ) : classrooms.length ? (
        <section className="border-y border-border-strong bg-surface-primary py-5">
          {classrooms.map((classroom) => (
            <div key={classroom.id} className="flex justify-between gap-4 border-b border-border-default px-4 py-3 last:border-0">
              <span className="font-bold">{classroom.subject}</span>
              <span>Room {classroom.room}</span>
            </div>
          ))}
        </section>
      ) : (
        <TimetableEmptyState
          message="No timetable is available for this section."
          detail="Contact the department for an updated schedule."
        />
      )}
    </section>
  )
}
