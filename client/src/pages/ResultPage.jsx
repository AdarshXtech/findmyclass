import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import {
  HiOutlineArrowLeft,
  HiOutlineCalendar,
  HiOutlineChevronDown,
  HiOutlineClock,
  HiOutlineMenuAlt3,
  HiOutlineX,
} from 'react-icons/hi'
import ClassLocationHeader from '../components/ClassLocationHeader'

const weekdays = [
  { id: 1, name: 'Monday', shortName: 'MON' },
  { id: 2, name: 'Tuesday', shortName: 'TUE' },
  { id: 3, name: 'Wednesday', shortName: 'WED' },
  { id: 4, name: 'Thursday', shortName: 'THU' },
  { id: 5, name: 'Friday', shortName: 'FRI' },
]

function formatName(name) {
  return String(name || '').toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function formatTime(value) {
  const [hourValue, minute = '00'] = String(value || '').split(':')
  const hour = Number(hourValue)
  if (!Number.isInteger(hour)) return value
  return `${hour % 12 || 12}:${minute} ${hour >= 12 ? 'PM' : 'AM'}`
}

function sortByStartTime(entries) {
  return [...entries].sort((left, right) => String(left.startTime).localeCompare(String(right.startTime)))
}

function ClassEntry({ entry, status = 'upcoming', priorityLabel = 'Next class', compact = false }) {
  if (entry.sessionType === 'Break') {
    return (
      <article className="grid gap-3 bg-surface-highlight px-4 py-4 sm:grid-cols-[190px_minmax(0,1fr)_160px] sm:items-center sm:px-6">
        <div className="flex items-center gap-2 whitespace-nowrap font-mono text-sm font-bold">
          <HiOutlineClock className="text-lg text-accent-primary" />
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
      <article className="grid min-w-0 gap-3 bg-surface-primary px-4 py-4 md:grid-cols-[180px_minmax(0,1fr)_220px] md:items-center md:gap-6 md:px-6" aria-label={`${entry.subjectName}, ${entry.classroomNumber ? `room ${entry.classroomNumber}` : 'room not listed'}`}>
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
        <ClassLocationHeader entry={entry} compact inline />
      </article>
    )
  }

  return (
    <article className="min-w-0 bg-surface-primary" aria-label={`${entry.subjectName}, ${entry.classroomNumber ? `room ${entry.classroomNumber}` : 'room not listed'}${completed ? ', completed' : ''}`}>
      <ClassLocationHeader entry={entry} compact={compact} highlighted={highlighted} />

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

function EmptySchedule({ message, detail }) {
  return (
    <section className="border-y border-border-strong bg-surface-primary px-5 py-9">
      <p className="font-display text-xl font-bold">{message}</p>
      {detail ? <p className="mt-1 text-sm text-text-secondary">{detail}</p> : null}
    </section>
  )
}

export default function ResultPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const data = location.state?.lookupData || null
  const [menuOpen, setMenuOpen] = useState(false)
  const [todayExpanded, setTodayExpanded] = useState(false)
  const [now, setNow] = useState(() => new Date())
  const currentDay = now.getDay()
  const [expandedDay, setExpandedDay] = useState(() => currentDay >= 1 && currentDay <= 5 ? currentDay : 1)
  const activeView = searchParams.get('view') === 'weekly' ? 'weekly' : 'daily'

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' })
  }, [])

  useEffect(() => {
    const clock = window.setInterval(() => setNow(new Date()), 60000)
    return () => window.clearInterval(clock)
  }, [])

  useEffect(() => {
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setMenuOpen(false)
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [])

  const timetableByDay = useMemo(() => {
    const grouped = new Map(weekdays.map((day) => [day.id, []]))
    for (const entry of data?.timetable || []) {
      if (grouped.has(entry.dayOfWeek)) grouped.get(entry.dayOfWeek).push(entry)
    }
    for (const [day, entries] of grouped) grouped.set(day, sortByStartTime(entries))
    return grouped
  }, [data])

  if (!data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface-secondary px-5 text-text-primary">
        <div className="w-full max-w-lg border-y border-border-strong py-8">
          <p className="text-xs font-bold uppercase text-accent-primary">Student verification</p>
          <h1 className="mt-3 font-display text-4xl font-bold">We could not open that timetable.</h1>
          <p className="mt-4 leading-7 text-text-secondary">Verify your name and phone number to open your assigned timetable.</p>
          <div className="mt-7 flex flex-wrap gap-3">
            <button onClick={() => navigate('/')} className="flex items-center gap-2 border border-border-strong px-5 py-3 font-bold">
              <HiOutlineArrowLeft /> Verify student
            </button>
          </div>
        </div>
      </div>
    )
  }

  const { student, timetable = [], classrooms = [] } = data
  const displayName = formatName(student.name)
  const displaySection = String(student.section || '').replace(/^(CSAI)(\d)([A-Z])$/, '$1 $2$3')
  const teachingEntries = timetable.filter((entry) => entry.sessionType !== 'Break')
  const subjectCount = new Set(teachingEntries.map((entry) => entry.subjectCode || entry.subjectName)).size
  const todayEntries = timetableByDay.get(currentDay) || []
  const todayClasses = todayEntries.filter((entry) => entry.sessionType !== 'Break')
  const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
  const activeClass = todayClasses.find((entry) => entry.startTime <= currentTime && entry.endTime > currentTime)
  const nextUpcomingClass = todayClasses.find((entry) => entry.startTime > currentTime)
  const firstScheduledClass = todayClasses[0] || null
  const firstClassFallback = !activeClass
    && !nextUpcomingClass
    && firstScheduledClass
    && currentTime < firstScheduledClass.startTime
      ? firstScheduledClass
      : null
  const locationEntry = activeClass ?? nextUpcomingClass ?? firstClassFallback
  const priorityEntry = locationEntry
  const locationStatus = activeClass
    ? 'Current class'
    : nextUpcomingClass
      ? 'Next class'
      : firstClassFallback
        ? "Today's first class"
        : null
  const finishedForToday = todayClasses.length > 0 && !locationEntry
  const formattedDate = new Intl.DateTimeFormat('en-IN', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  }).format(now)

  const selectView = (view) => {
    setSearchParams(
      view === 'weekly' ? { view: 'weekly' } : {},
      { replace: true, state: location.state }
    )
    setMenuOpen(false)
  }

  const selectedClassDetails = [
    ['Subject', locationEntry?.subjectName || 'Not scheduled'],
    ['Type of class', locationEntry?.sessionType || 'Not scheduled'],
    ['Teacher', locationEntry?.facultyName || 'Not scheduled'],
  ]

  return (
    <div className="min-h-screen bg-surface-secondary text-text-primary">
      <header className="relative z-30 border-b border-border-default bg-surface-primary">
        <div className="relative mx-auto flex max-w-6xl items-center justify-between px-5 py-4 sm:px-8">
          <button onClick={() => navigate('/')} className="flex h-11 w-11 items-center justify-center border border-border-strong transition hover:bg-surface-inverse hover:text-text-on-dark" aria-label="Search again" title="Search again">
            <HiOutlineArrowLeft className="text-xl" />
          </button>
          <p className="font-display text-lg font-bold">Find My Class</p>
          <div className="flex items-center gap-3">
            <p className="hidden font-mono text-xs font-bold text-accent-primary sm:block">2026-27</p>
            <button
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              className="flex h-11 w-11 items-center justify-center border border-border-strong transition hover:bg-surface-inverse hover:text-text-on-dark"
              aria-label={menuOpen ? 'Close schedule menu' : 'Open schedule menu'}
              aria-expanded={menuOpen}
              aria-controls="schedule-menu"
            >
              {menuOpen ? <HiOutlineX className="text-xl" /> : <HiOutlineMenuAlt3 className="text-xl" />}
            </button>
          </div>

          <nav
            id="schedule-menu"
            aria-label="Schedule views"
            aria-hidden={!menuOpen}
            className={`absolute right-5 top-[calc(100%+1px)] w-[min(280px,calc(100vw-40px))] border border-t-0 border-border-strong bg-surface-primary shadow-brand transition duration-200 sm:right-8 ${menuOpen ? 'translate-y-0 opacity-100' : 'pointer-events-none -translate-y-2 opacity-0'}`}
          >
            {[
              ['daily', 'Today Classes'],
              ['weekly', 'Weekly Classes'],
            ].map(([view, label]) => (
              <button
                key={view}
                type="button"
                onClick={() => selectView(view)}
                tabIndex={menuOpen ? 0 : -1}
                className={`flex w-full items-center justify-between border-b border-border-default px-5 py-4 text-left font-bold last:border-0 ${activeView === view ? 'bg-accent-highlight text-text-primary' : 'hover:bg-surface-secondary'}`}
                aria-current={activeView === view ? 'page' : undefined}
              >
                <span>{label}</span>
                {activeView === view ? <span className="h-2 w-2 bg-accent-primary" aria-hidden="true" /> : null}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 py-10 sm:px-8 md:py-14">
        <section className="border-b-2 border-border-strong pb-8">
          <p className="font-mono text-xs font-bold uppercase text-accent-primary">{displaySection} / Semester III</p>
          <div className="mt-4 grid min-w-0 gap-8 lg:grid-cols-[minmax(260px,360px)_minmax(0,1fr)] lg:items-start">
            <div className="min-w-0">
              <h1 className="font-display text-4xl font-bold leading-tight [overflow-wrap:anywhere] sm:text-5xl">{displayName}</h1>
              <div className="mt-4 flex min-w-0 flex-col gap-1.5 text-sm font-semibold text-text-secondary sm:flex-row sm:flex-wrap sm:gap-x-4 sm:gap-y-2 sm:text-base">
                <p className="[overflow-wrap:anywhere]">{student.course} {student.branch}</p>
                <p>Year {student.year}</p>
                <p className="[overflow-wrap:anywhere]">Class {displaySection}</p>
              </div>
            </div>
            <div className="min-w-0">
              {locationEntry ? (
                <section className="border border-border-default bg-surface-primary" aria-label={`${locationStatus} location`}>
                  <div className="flex flex-wrap items-end justify-between gap-3 border-b border-border-default bg-accent-highlight px-4 py-3">
                    <div>
                      <p className="font-mono text-xs font-black uppercase tracking-wide text-accent-strong">{locationStatus}</p>
                      <p className="mt-1 min-w-0 font-bold leading-snug [overflow-wrap:anywhere]">{locationEntry.subjectName}</p>
                    </div>
                    <p className="font-mono text-xs font-bold">
                      Starts at <time>{formatTime(locationEntry.startTime)}</time>
                    </p>
                  </div>
                  <ClassLocationHeader entry={locationEntry} />
                </section>
              ) : (
                <section className="border border-border-default bg-surface-primary px-4 py-5" aria-live="polite">
                  <p className="font-mono text-xs font-black uppercase tracking-wide text-accent-primary">Today&apos;s schedule</p>
                  <p className="mt-2 font-display text-xl font-bold">
                    {finishedForToday ? 'No more classes today' : 'No classes scheduled today'}
                  </p>
                  <p className="mt-1 text-sm text-text-secondary">Open Weekly Classes to check another day.</p>
                </section>
              )}

              {locationEntry ? (
                <dl className="grid border-x border-b border-border-default bg-surface-muted sm:grid-cols-3">
                  {selectedClassDetails.map(([label, value], index) => (
                    <div key={label} className={`min-w-0 px-3 py-3 ${index < selectedClassDetails.length - 1 ? 'max-sm:border-b max-sm:border-border-default sm:border-r sm:border-border-default' : ''}`}>
                      <dt className="text-xs font-bold uppercase tracking-wide text-text-secondary">{label}</dt>
                      <dd className="mt-1 text-sm font-bold [overflow-wrap:anywhere]" title={String(value)}>{value}</dd>
                    </div>
                  ))}
                </dl>
              ) : null}
            </div>
          </div>
        </section>

        {activeView === 'daily' ? (
          <section className="mt-10 border-y-2 border-border-strong">
            <button
              type="button"
              onClick={() => setTodayExpanded((expanded) => !expanded)}
              className={`grid w-full text-left transition-colors sm:grid-cols-[minmax(0,1fr)_180px] ${todayExpanded ? 'bg-accent-highlight' : 'bg-surface-primary hover:bg-surface-muted'}`}
              aria-expanded={todayExpanded}
              aria-controls="today-schedule"
            >
              <span className="flex items-center gap-3 px-4 py-5 sm:px-6">
                <HiOutlineCalendar className="shrink-0 text-2xl text-accent-primary" />
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
                <HiOutlineChevronDown className={`shrink-0 text-xl transition-transform duration-200 ${todayExpanded ? 'rotate-180' : ''}`} />
              </span>
            </button>

            <div
              id="today-schedule"
              aria-hidden={!todayExpanded}
              className="grid transition-[grid-template-rows] duration-300"
              style={{ gridTemplateRows: todayExpanded ? '1fr' : '0fr' }}
            >
              <div className="overflow-hidden">
                {todayClasses.length ? (
                  <div className="divide-y divide-border-default border-t border-border-default bg-surface-primary">
                    {todayEntries.map((entry) => (
                      <ClassEntry
                        key={entry.id}
                        entry={entry}
                        status={entry.id === priorityEntry?.id ? 'priority' : entry.sessionType !== 'Break' && entry.endTime <= currentTime ? 'completed' : 'upcoming'}
                        priorityLabel={entry.id === activeClass?.id ? 'Current class' : 'Next class'}
                      />
                    ))}
                  </div>
                ) : (
                  <EmptySchedule message="No classes scheduled for today." detail="Your weekly timetable is still available from the menu." />
                )}
              </div>
            </div>
          </section>
        ) : (
          <section>
            <div className="mb-7 mt-10 flex flex-wrap items-baseline justify-between gap-3">
              <div className="flex items-center gap-3">
                <HiOutlineCalendar className="text-2xl text-accent-primary" />
                <h2 className="font-display text-3xl font-bold">Weekly classes</h2>
              </div>
              {timetable.length ? <p className="text-sm text-text-secondary">{subjectCount} subjects / {teachingEntries.length} sessions</p> : null}
            </div>

            {timetable.length ? (
              <div className="border-t-2 border-border-strong">
                {weekdays.map((day) => {
                  const entries = timetableByDay.get(day.id) || []
                  const classCount = entries.filter((entry) => entry.sessionType !== 'Break').length
                  const isExpanded = expandedDay === day.id
                  return (
                    <section key={day.id} className="border-b border-border-default">
                      <button
                        type="button"
                        onClick={() => setExpandedDay(isExpanded ? null : day.id)}
                        className={`grid w-full text-left transition-colors md:grid-cols-[150px_minmax(0,1fr)] ${isExpanded ? 'bg-accent-highlight' : 'bg-surface-primary hover:bg-surface-muted'}`}
                        aria-expanded={isExpanded}
                        aria-controls={`day-${day.id}`}
                      >
                        <span className="flex items-baseline justify-between px-4 py-4 md:block md:bg-accent-highlight md:py-5">
                          <span className="font-mono text-xs font-black">{day.shortName}</span>
                          <span className="mt-1 block font-display text-xl font-bold">{day.name}</span>
                        </span>
                        <span className="flex items-center justify-between gap-4 px-4 py-4 md:px-6">
                          <span className="text-sm font-medium text-text-secondary">{classCount ? `${classCount} ${classCount === 1 ? 'class' : 'classes'}` : 'No classes'}</span>
                          <HiOutlineChevronDown className={`text-xl transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                        </span>
                      </button>
                      <div
                        id={`day-${day.id}`}
                        aria-hidden={!isExpanded}
                        className="grid transition-[grid-template-rows] duration-300"
                        style={{ gridTemplateRows: isExpanded ? '1fr' : '0fr' }}
                      >
                        <div className="overflow-hidden">
                          {classCount ? (
                            <div className="divide-y divide-border-default bg-surface-primary">
                              {entries.map((entry) => (
                                <ClassEntry key={entry.id} entry={entry} compact />
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
                })}
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
              <EmptySchedule message="No timetable is available for this section." detail="Contact the department for an updated schedule." />
            )}
          </section>
        )}

        <footer className="mt-10 flex flex-wrap items-center justify-between gap-2 border-t border-border-default pt-5 text-xs text-text-secondary">
          <span>Academic session {timetable[0]?.academicSession || '2026-27'}</span>
          <span>Room assignments may be revised by the department.</span>
        </footer>
      </main>
    </div>
  )
}
