import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import {
  HiOutlineArrowLeft,
  HiOutlineMenuAlt3,
  HiOutlineX,
} from 'react-icons/hi'
import DailySchedule from '../components/timetable/DailySchedule'
import NextClassHero from '../components/timetable/NextClassHero'
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
    setSearchParams(
      view === 'weekly' ? { view: 'weekly' } : {},
      { replace: true, state: location.state }
    )
    setMenuOpen(false)
  }

  if (!data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface-secondary px-5 text-text-primary">
        <div className="w-full max-w-lg border-y border-border-strong py-8">
          <p className="text-xs font-bold uppercase text-accent-primary">Student verification</p>
          <h1 className="mt-3 font-display text-4xl font-bold">We could not open that timetable.</h1>
          <p className="mt-4 leading-7 text-text-secondary">Verify your name and phone number to open your assigned timetable.</p>
          <div className="mt-7 flex flex-wrap gap-3">
            <button onClick={() => navigate('/')} className="flex items-center gap-2 border border-border-strong px-5 py-3 font-bold">
              <HiOutlineArrowLeft aria-hidden="true" /> Verify student
            </button>
          </div>
        </div>
      </div>
    )
  }

  const { student, classrooms = [] } = data

  return (
    <div className="min-h-screen bg-surface-secondary text-text-primary">
      <header className="relative z-30 border-b border-border-default bg-surface-primary">
        <div className="relative mx-auto flex max-w-6xl items-center justify-between px-5 py-4 sm:px-8">
          <button
            onClick={() => navigate('/')}
            className="flex h-11 w-11 items-center justify-center border border-border-strong transition hover:bg-surface-inverse hover:text-text-on-dark"
            aria-label="Search again"
            title="Search again"
          >
            <HiOutlineArrowLeft aria-hidden="true" className="text-xl" />
          </button>
          <p className="font-display text-lg font-bold">Find My Class</p>
          <div className="flex items-center gap-3">
            <p className="hidden font-mono text-xs font-bold text-accent-primary sm:block">2026-27</p>
            <button
              ref={menuButtonRef}
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              className="flex h-11 w-11 items-center justify-center border border-border-strong transition hover:bg-surface-inverse hover:text-text-on-dark"
              aria-label={menuOpen ? 'Close schedule menu' : 'Open schedule menu'}
              aria-expanded={menuOpen}
              aria-controls="schedule-menu"
            >
              {menuOpen
                ? <HiOutlineX aria-hidden="true" className="text-xl" />
                : <HiOutlineMenuAlt3 aria-hidden="true" className="text-xl" />}
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
        <StudentContext student={student}>
          <NextClassHero
            entry={status.priorityEntry}
            status={status.locationStatus}
            finishedForToday={status.finishedForToday}
          />
        </StudentContext>

        {activeView === 'daily' ? (
          <DailySchedule
            activeEntry={status.activeEntry}
            currentTime={status.currentTime}
            expanded={expansion.todayExpanded}
            formattedDate={status.formattedDate}
            onToggle={expansion.toggleToday}
            priorityEntry={status.priorityEntry}
            todayClasses={status.todayClasses}
            todayEntries={status.todayEntries}
          />
        ) : (
          <WeeklySchedule
            classrooms={classrooms}
            expandedDay={expansion.expandedDay}
            onDayToggle={expansion.toggleDay}
            subjectCount={status.subjectCount}
            teachingEntries={status.teachingEntries}
            timetable={timetable}
            timetableByDay={status.timetableByDay}
          />
        )}

        <footer className="mt-10 flex flex-wrap items-center justify-between gap-2 border-t border-border-default pt-5 text-xs text-text-secondary">
          <span>Academic session {timetable[0]?.academicSession || '2026-27'}</span>
          <span>Room assignments may be revised by the department.</span>
        </footer>
      </main>
    </div>
  )
}
