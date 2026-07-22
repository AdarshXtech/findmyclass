import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  HiOutlineArrowLeft,
  HiOutlineCalendar,
  HiOutlineChevronDown,
  HiOutlineClock,
  HiOutlineMenuAlt3,
  HiOutlineX,
} from 'react-icons/hi'
import { lookupStudentSchedule } from '../api/publicApi'
import { isValidUniversityRollNumber, normalizeUniversityRollNumber } from '../utils/universityRoll'

const weekdays = [
  { id: 1, name: 'Monday', shortName: 'MON' },
  { id: 2, name: 'Tuesday', shortName: 'TUE' },
  { id: 3, name: 'Wednesday', shortName: 'WED' },
  { id: 4, name: 'Thursday', shortName: 'THU' },
  { id: 5, name: 'Friday', shortName: 'FRI' },
  { id: 6, name: 'Saturday', shortName: 'SAT' },
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

function ClassEntry({ entry }) {
  if (entry.sessionType === 'Break') {
    return (
      <article className="grid gap-3 bg-[#f3dfaa] px-4 py-4 sm:grid-cols-[190px_minmax(0,1fr)_160px] sm:items-center sm:px-6">
        <div className="flex items-center gap-2 whitespace-nowrap font-mono text-sm font-bold">
          <HiOutlineClock className="text-lg text-[#a33a2b]" />
          <span>{formatTime(entry.startTime)} &ndash; {formatTime(entry.endTime)}</span>
        </div>
        <p className="font-display text-lg font-bold">Lunch break</p>
        <p className="text-sm font-medium text-[#6b5b32] sm:text-right">No class scheduled</p>
      </article>
    )
  }

  const locations = [
    ['Floor', entry.floor || 'Not listed'],
    ['Wing', entry.wing || 'Not listed'],
    ['Classroom', entry.classroomNumber || entry.room || 'Not listed'],
  ]

  return (
    <article className="grid gap-4 px-4 py-5 sm:px-6 lg:grid-cols-[180px_minmax(0,1fr)_280px] lg:items-center">
      <div className="flex items-center gap-2 whitespace-nowrap font-mono text-sm font-bold">
        <HiOutlineClock className="text-lg text-[#a33a2b]" />
        <time>{formatTime(entry.startTime)} &ndash; {formatTime(entry.endTime)}</time>
      </div>
      <div className="min-w-0">
        <div className="mb-1 flex flex-wrap items-center gap-2 text-xs">
          {entry.subjectCode ? <span className="font-mono font-black text-[#17726a]">{entry.subjectCode}</span> : null}
          <span className="text-[#73776d]">{entry.sessionType}</span>
        </div>
        <h3 className="font-bold leading-5">{entry.subjectName}</h3>
        <p className="mt-1 text-sm text-[#6b6f65]">{entry.facultyName || 'Teacher not listed'}</p>
      </div>
      <dl className="grid grid-cols-3 border border-[#20211e]/20 bg-[#f3efe5]">
        {locations.map(([label, value], index) => (
          <div key={label} className={`min-w-0 px-3 py-2 ${index < locations.length - 1 ? 'border-r border-[#20211e]/20' : ''}`}>
            <dt className="text-[9px] font-bold uppercase text-[#73776d]">{label}</dt>
            <dd className="mt-1 truncate text-sm font-bold" title={value}>{value}</dd>
          </div>
        ))}
      </dl>
    </article>
  )
}

function EmptySchedule({ message, detail }) {
  return (
    <section className="border-y border-[#20211e] bg-[#fffdf7] px-5 py-9">
      <p className="font-display text-xl font-bold">{message}</p>
      {detail ? <p className="mt-1 text-sm text-[#6b6f65]">{detail}</p> : null}
    </section>
  )
}

export default function ResultPage() {
  const { universityRollNumber } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const normalizedRollNumber = normalizeUniversityRollNumber(universityRollNumber)
  const initialData = location.state?.universityRollNumber === normalizedRollNumber
    ? location.state?.lookupData
    : null
  const [data, setData] = useState(initialData || null)
  const [loading, setLoading] = useState(!initialData)
  const [loadingMessage, setLoadingMessage] = useState('Loading timetable and room assignments...')
  const [error, setError] = useState('')
  const [canRetry, setCanRetry] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [now, setNow] = useState(() => new Date())
  const currentDay = now.getDay()
  const [expandedDay, setExpandedDay] = useState(() => currentDay >= 1 && currentDay <= 6 ? currentDay : 1)
  const activeView = searchParams.get('view') === 'weekly' ? 'weekly' : 'daily'

  const lookupStudent = async () => {
    setLoading(true)
    setError('')
    setCanRetry(false)
    setData(null)
    setLoadingMessage('Loading timetable and room assignments...')

    if (!isValidUniversityRollNumber(normalizedRollNumber)) {
      setError('Enter a valid university roll number.')
      setLoading(false)
      return
    }

    const wakeMessageTimer = window.setTimeout(() => {
      setLoadingMessage('The free server is waking up. This can take about a minute...')
    }, 6000)

    try {
      const response = await lookupStudentSchedule(normalizedRollNumber, {
        onRetry: () => setLoadingMessage('Server is awake. Retrying the timetable...'),
      })
      setData(response.data.data)
    } catch (requestError) {
      if (requestError.response?.status === 404) {
        setError('No CSAI 2B student was found with that university roll number.')
      } else {
        setError(requestError.response?.data?.message || 'The schedule service is unavailable right now.')
        setCanRetry(true)
      }
    } finally {
      window.clearTimeout(wakeMessageTimer)
      setLoading(false)
    }
  }

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' })
  }, [universityRollNumber])

  useEffect(() => {
    if (!initialData) lookupStudent()
  }, [universityRollNumber])

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

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f3efe5] px-5 text-[#20211e]">
        <div className="border-l-4 border-[#a33a2b] pl-5" role="status">
          <p className="font-display text-2xl font-bold">Reading the class roster</p>
          <p className="mt-1 text-sm text-[#6b6f65]">{loadingMessage}</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f3efe5] px-5 text-[#20211e]">
        <div className="w-full max-w-lg border-y border-[#20211e] py-8">
          <p className="text-xs font-bold uppercase text-[#a33a2b]">{canRetry ? 'Service unavailable' : 'Roster check'}</p>
          <h1 className="mt-3 font-display text-4xl font-bold">We could not open that timetable.</h1>
          <p className="mt-4 leading-7 text-[#55594f]">{error}</p>
          <div className="mt-7 flex flex-wrap gap-3">
            {canRetry ? <button onClick={lookupStudent} className="bg-[#a33a2b] px-5 py-3 font-bold text-white">Retry</button> : null}
            <button onClick={() => navigate('/')} className="flex items-center gap-2 border border-[#20211e] px-5 py-3 font-bold">
              <HiOutlineArrowLeft /> Search again
            </button>
          </div>
        </div>
      </div>
    )
  }

  const { student, timetable = [], classrooms = [] } = data
  const displayName = formatName(student.name)
  const displaySection = student.section === 'CSAI2B' ? 'CSAI 2B' : student.section
  const teachingEntries = timetable.filter((entry) => entry.sessionType !== 'Break')
  const subjectCount = new Set(teachingEntries.map((entry) => entry.subjectCode || entry.subjectName)).size
  const todayEntries = timetableByDay.get(currentDay) || []
  const todayClasses = todayEntries.filter((entry) => entry.sessionType !== 'Break')
  const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
  const locationEntry = todayClasses.find((entry) => entry.endTime > currentTime) || todayClasses.at(-1)
  const locationValues = {
    floor: locationEntry?.floor || 'Not listed',
    wing: locationEntry?.wing || 'Not listed',
    classroom: locationEntry?.classroomNumber || locationEntry?.room || 'Not listed',
  }
  const formattedDate = new Intl.DateTimeFormat('en-IN', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  }).format(now)

  const selectView = (view) => {
    setSearchParams(view === 'weekly' ? { view: 'weekly' } : {}, { replace: true })
    setMenuOpen(false)
  }

  const studentDetails = [
    ['Course', `${student.course} ${student.branch}`],
    ['Year', `Year ${student.year}`],
    ['Class roll number', student.classRollNumber || 'Not listed'],
    ['Floor', locationValues.floor],
    ['Wing', locationValues.wing],
    ['Classroom number', locationValues.classroom],
  ]

  return (
    <div className="min-h-screen bg-[#f3efe5] text-[#20211e]">
      <header className="relative z-30 border-b border-[#20211e]/20 bg-[#fffdf7]">
        <div className="relative mx-auto flex max-w-6xl items-center justify-between px-5 py-4 sm:px-8">
          <button onClick={() => navigate('/')} className="flex h-10 w-10 items-center justify-center border border-[#20211e] transition hover:bg-[#20211e] hover:text-white" aria-label="Search again" title="Search again">
            <HiOutlineArrowLeft className="text-xl" />
          </button>
          <p className="font-display text-lg font-bold">Find My Class</p>
          <div className="flex items-center gap-3">
            <p className="hidden font-mono text-xs font-bold text-[#a33a2b] sm:block">2026-27</p>
            <button
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              className="flex h-10 w-10 items-center justify-center border border-[#20211e] transition hover:bg-[#20211e] hover:text-white"
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
            className={`absolute right-5 top-[calc(100%+1px)] w-[min(280px,calc(100vw-40px))] border border-t-0 border-[#20211e] bg-[#fffdf7] shadow-[8px_8px_0_#a33a2b] transition duration-200 sm:right-8 ${menuOpen ? 'translate-y-0 opacity-100' : 'pointer-events-none -translate-y-2 opacity-0'}`}
          >
            {[
              ['daily', 'Daily Classes'],
              ['weekly', 'Weekly Classes'],
            ].map(([view, label]) => (
              <button
                key={view}
                type="button"
                onClick={() => selectView(view)}
                tabIndex={menuOpen ? 0 : -1}
                className={`flex w-full items-center justify-between border-b border-[#20211e]/20 px-5 py-4 text-left font-bold last:border-0 ${activeView === view ? 'bg-[#e6b845] text-[#20211e]' : 'hover:bg-[#f3efe5]'}`}
                aria-current={activeView === view ? 'page' : undefined}
              >
                <span>{label}</span>
                {activeView === view ? <span className="h-2 w-2 bg-[#a33a2b]" aria-hidden="true" /> : null}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 py-10 sm:px-8 md:py-14">
        <section className="border-b-2 border-[#20211e] pb-8">
          <p className="font-mono text-xs font-bold uppercase text-[#a33a2b]">{displaySection} / Semester III</p>
          <div className="mt-4 grid gap-7 lg:grid-cols-[minmax(0,1fr)_minmax(520px,auto)] lg:items-end">
            <div>
              <h1 className="font-display text-4xl font-bold leading-tight sm:text-5xl">{displayName}</h1>
              <p className="mt-2 text-[#62665d]">University roll <span className="font-mono">{student.universityRollNumber}</span></p>
            </div>
            <dl className="grid grid-cols-2 border border-[#20211e]/30 bg-[#fffdf7] sm:grid-cols-3">
              {studentDetails.map(([label, value], index) => (
                <div key={label} className={`min-w-0 px-3 py-3 ${index % 3 !== 2 ? 'sm:border-r sm:border-[#20211e]/20' : ''} ${index < 3 ? 'sm:border-b sm:border-[#20211e]/20' : ''} ${index < 4 ? 'max-sm:border-b max-sm:border-[#20211e]/20' : ''} ${index % 2 === 0 ? 'max-sm:border-r max-sm:border-[#20211e]/20' : ''}`}>
                  <dt className="text-[9px] font-bold uppercase text-[#73776d]">{label}</dt>
                  <dd className="mt-1 truncate text-sm font-bold" title={String(value)}>{value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {activeView === 'daily' ? (
          <section>
            <div className="mb-7 mt-10 flex flex-wrap items-end justify-between gap-4">
              <div>
                <div className="flex items-center gap-3">
                  <HiOutlineCalendar className="text-2xl text-[#a33a2b]" />
                  <h2 className="font-display text-3xl font-bold">Daily classes</h2>
                </div>
                <p className="mt-2 font-mono text-sm font-bold text-[#6b6f65]">{formattedDate}</p>
              </div>
              {todayClasses.length ? <p className="text-sm text-[#6b6f65]">{todayClasses.length} {todayClasses.length === 1 ? 'class' : 'classes'}</p> : null}
            </div>

            {todayClasses.length ? (
              <div className="divide-y divide-[#20211e]/20 border-y-2 border-[#20211e] bg-[#fffdf7]">
                {todayEntries.map((entry) => <ClassEntry key={entry.id} entry={entry} />)}
              </div>
            ) : (
              <EmptySchedule message="No classes scheduled for today." detail="Your weekly timetable is still available from the menu." />
            )}
          </section>
        ) : (
          <section>
            <div className="mb-7 mt-10 flex flex-wrap items-baseline justify-between gap-3">
              <div className="flex items-center gap-3">
                <HiOutlineCalendar className="text-2xl text-[#a33a2b]" />
                <h2 className="font-display text-3xl font-bold">Weekly classes</h2>
              </div>
              {timetable.length ? <p className="text-sm text-[#6b6f65]">{subjectCount} subjects / {teachingEntries.length} sessions</p> : null}
            </div>

            {timetable.length ? (
              <div className="border-t-2 border-[#20211e]">
                {weekdays.map((day) => {
                  const entries = timetableByDay.get(day.id) || []
                  const classCount = entries.filter((entry) => entry.sessionType !== 'Break').length
                  const isExpanded = expandedDay === day.id
                  return (
                    <section key={day.id} className="border-b border-[#20211e]/35">
                      <button
                        type="button"
                        onClick={() => setExpandedDay(isExpanded ? null : day.id)}
                        className={`grid w-full text-left transition-colors md:grid-cols-[150px_minmax(0,1fr)] ${isExpanded ? 'bg-[#e6b845]' : 'bg-[#fffdf7] hover:bg-[#eee8dc]'}`}
                        aria-expanded={isExpanded}
                        aria-controls={`day-${day.id}`}
                      >
                        <span className="flex items-baseline justify-between px-4 py-4 md:block md:bg-[#e6b845] md:py-5">
                          <span className="font-mono text-xs font-black">{day.shortName}</span>
                          <span className="mt-1 block font-display text-xl font-bold">{day.name}</span>
                        </span>
                        <span className="flex items-center justify-between gap-4 px-4 py-4 md:px-6">
                          <span className="text-sm font-medium text-[#55594f]">{classCount ? `${classCount} ${classCount === 1 ? 'class' : 'classes'}` : 'No classes'}</span>
                          <HiOutlineChevronDown className={`text-xl transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                        </span>
                      </button>
                      <div
                        id={`day-${day.id}`}
                        className="grid transition-[grid-template-rows] duration-300"
                        style={{ gridTemplateRows: isExpanded ? '1fr' : '0fr' }}
                      >
                        <div className="overflow-hidden">
                          {classCount ? (
                            <div className="divide-y divide-[#20211e]/20 bg-[#fffdf7]">
                              {entries.map((entry) => <ClassEntry key={entry.id} entry={entry} />)}
                            </div>
                          ) : (
                            <div className="bg-[#fffdf7] px-6 py-8">
                              <p className="font-display text-xl font-bold text-[#55594f]">No classes scheduled.</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </section>
                  )
                })}
              </div>
            ) : classrooms.length ? (
              <section className="border-y border-[#20211e] bg-[#fffdf7] py-5">
                {classrooms.map((classroom) => (
                  <div key={classroom.id} className="flex justify-between gap-4 border-b border-[#20211e]/20 px-4 py-3 last:border-0">
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

        <footer className="mt-10 flex flex-wrap items-center justify-between gap-2 border-t border-[#20211e]/20 pt-5 text-xs text-[#73776d]">
          <span>Academic session {timetable[0]?.academicSession || '2026-27'}</span>
          <span>Room assignments may be revised by the department.</span>
        </footer>
      </main>
    </div>
  )
}
