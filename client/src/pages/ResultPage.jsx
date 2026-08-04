import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { HiOutlineArrowLeft, HiOutlineMenuAlt3, HiOutlineX } from 'react-icons/hi'
import DailySchedule from '../components/timetable/DailySchedule'
import NextClassHero from '../components/timetable/NextClassHero'
import ScheduleNavigation from '../components/timetable/ScheduleNavigation'
import StudentContext from '../components/timetable/StudentContext'
import WeeklySchedule from '../components/timetable/WeeklySchedule'
import useCurrentTime from '../hooks/useCurrentTime'
import useScheduleExpansion from '../hooks/useScheduleExpansion'
import useTimetableStatus from '../hooks/useTimetableStatus'

const EMPTY_TIMETABLE = []

export default function ResultPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuButtonRef = useRef(null)
  const data = location.state?.lookupData || null
  const timetable = data?.timetable ?? EMPTY_TIMETABLE
  const now = useCurrentTime()
  const status = useTimetableStatus(timetable, now)
  const expansion = useScheduleExpansion(status.currentDay, status.shouldAutoExpandToday)
  const activeView = searchParams.get('view') === 'weekly' ? 'weekly' : 'daily'

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' })
  }, [])

  useEffect(() => {
    const closeOnEscape = (event) => {
      if (event.key === 'Escape' && menuOpen) {
        setMenuOpen(false)
        menuButtonRef.current?.focus()
      }
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [menuOpen])

  const selectView = (view) => {
    setSearchParams(view === 'weekly' ? { view: 'weekly' } : {}, { replace: true, state: location.state })
    setMenuOpen(false)
  }

  if (!data) {
    return (
      <div className="student-result-theme flex min-h-screen items-center justify-center bg-surface-secondary px-5 text-text-primary">
        <div className="w-full max-w-lg rounded-lg border border-border-default bg-surface-primary p-7">
          <p className="font-mono text-xs font-bold uppercase tracking-wide text-accent-primary">Student verification</p>
          <h1 className="mt-3 font-display text-3xl font-bold">We could not open that timetable.</h1>
          <p className="mt-4 leading-7 text-text-secondary">Verify your name and phone number to open your assigned timetable.</p>
          <button onClick={() => navigate('/')} className="mt-7 flex min-h-11 items-center gap-2 rounded-lg bg-result-blue px-5 py-3 font-bold text-text-on-dark">
            <HiOutlineArrowLeft aria-hidden="true" /> Verify student
          </button>
        </div>
      </div>
    )
  }

  const { student, classrooms = [] } = data

  return (
    <div className="student-result-theme min-h-screen bg-surface-secondary text-text-primary">
      <header className="relative z-30 border-b border-border-default bg-surface-primary">
        <div className="relative mx-auto flex max-w-[1400px] items-center justify-between px-5 py-4 sm:px-8 lg:px-12 2xl:px-[72px]">
          <button
            onClick={() => navigate('/')}
            className="flex h-11 w-11 items-center justify-center rounded-lg border border-border-strong transition-colors hover:border-result-blue hover:bg-result-blue-pale"
            aria-label="Search again"
            title="Search again"
          >
            <HiOutlineArrowLeft aria-hidden="true" className="text-xl" />
          </button>
          <p className="font-display text-lg font-bold">Find My Class</p>
          <div className="flex items-center gap-3">
            <p className="hidden font-mono text-xs font-bold text-accent-primary md:block">2026-27</p>
            <button
              ref={menuButtonRef}
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              className="flex h-11 w-11 items-center justify-center rounded-lg border border-border-strong transition-colors hover:border-result-blue hover:bg-result-blue-pale md:hidden"
              aria-label={menuOpen ? 'Close schedule menu' : 'Open schedule menu'}
              aria-expanded={menuOpen}
              aria-controls="schedule-menu"
            >
              {menuOpen ? <HiOutlineX aria-hidden="true" className="text-xl" /> : <HiOutlineMenuAlt3 aria-hidden="true" className="text-xl" />}
            </button>
          </div>

          <nav
            id="schedule-menu"
            aria-label="Mobile schedule views"
            aria-hidden={!menuOpen}
            className={`absolute right-5 top-[calc(100%+1px)] w-[min(280px,calc(100vw-40px))] rounded-b-lg border border-t-0 border-border-strong bg-surface-primary p-3 shadow-result transition duration-200 sm:right-8 md:hidden ${menuOpen ? 'translate-y-0 opacity-100' : 'pointer-events-none -translate-y-2 opacity-0'}`}
          >
            <ScheduleNavigation activeView={activeView} onSelect={selectView} tabIndex={menuOpen ? 0 : -1} />
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-[1400px] px-5 py-8 sm:px-8 sm:py-10 lg:px-12 lg:py-14 2xl:px-[72px]">
        <div className="grid min-w-0 gap-8 md:grid-cols-[minmax(220px,0.8fr)_minmax(0,1.4fr)] md:items-start lg:grid-cols-[minmax(280px,340px)_minmax(0,1fr)] lg:gap-12 xl:gap-16">
          <aside className="min-w-0 md:sticky md:top-8">
            <StudentContext student={student} />
            <div className="mt-8 hidden md:block">
              <p className="mb-3 font-mono text-xs font-bold uppercase tracking-wide text-text-secondary">Schedule view</p>
              <ScheduleNavigation activeView={activeView} onSelect={selectView} />
            </div>
          </aside>

          <section className="min-w-0">
            <NextClassHero
              entry={status.priorityEntry}
              status={status.locationStatus}
              finishedForToday={status.finishedForToday}
              timeContext={status.timeContext}
            />

            {activeView === 'daily' ? (
              <DailySchedule
                entryStatusById={status.entryStatusById}
                expanded={expansion.todayExpanded}
                formattedDate={status.formattedDate}
                locationStatus={status.locationStatus}
                onToggle={expansion.toggleToday}
                todayClasses={status.todayClasses}
                todayEntries={status.todayEntries}
              />
            ) : (
              <WeeklySchedule
                classrooms={classrooms}
                entryStatusById={status.entryStatusById}
                expandedDay={expansion.expandedDay}
                locationStatus={status.locationStatus}
                onDayToggle={expansion.toggleDay}
                subjectCount={status.subjectCount}
                teachingEntries={status.teachingEntries}
                timetable={timetable}
                timetableByDay={status.timetableByDay}
              />
            )}

            <footer className="mt-10 flex min-w-0 flex-wrap items-center justify-between gap-2 border-t border-border-default pt-5 text-xs text-text-secondary">
              <span>Academic session {timetable[0]?.academicSession || '2026-27'}</span>
              <span>Room assignments may be revised by the department.</span>
            </footer>
          </section>
        </div>
      </main>
    </div>
  )
}
