import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import {
  HiOutlineArrowLeft,
  HiOutlineCalendar,
  HiOutlineClock,
  HiOutlineLocationMarker,
} from 'react-icons/hi'
import { lookupStudentSchedule } from '../api/publicApi'
import { isValidUniversityRollNumber, normalizeUniversityRollNumber } from '../utils/universityRoll'

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

export default function ResultPage() {
  const { universityRollNumber } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const normalizedRollNumber = normalizeUniversityRollNumber(universityRollNumber)
  const initialData = location.state?.universityRollNumber === normalizedRollNumber
    ? location.state?.lookupData
    : null
  const [data, setData] = useState(initialData || null)
  const [loading, setLoading] = useState(!initialData)
  const [loadingMessage, setLoadingMessage] = useState('Loading timetable and room assignments...')
  const [error, setError] = useState('')
  const [canRetry, setCanRetry] = useState(false)

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

  const timetableByDay = useMemo(() => {
    const grouped = new Map(weekdays.map((day) => [day.id, []]))
    for (const entry of data?.timetable || []) grouped.get(entry.dayOfWeek)?.push(entry)
    return grouped
  }, [data])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f3efe5] px-5 text-[#20211e]">
        <div className="border-l-4 border-[#a33a2b] pl-5">
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

  return (
    <div className="min-h-screen bg-[#f3efe5] text-[#20211e]">
      <header className="border-b border-[#20211e]/20 bg-[#fffdf7]">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4 sm:px-8">
          <button onClick={() => navigate('/')} className="flex h-10 w-10 items-center justify-center border border-[#20211e] transition hover:bg-[#20211e] hover:text-white" aria-label="Search again" title="Search again">
            <HiOutlineArrowLeft className="text-xl" />
          </button>
          <p className="font-display text-lg font-bold">Find My Class</p>
          <p className="font-mono text-xs font-bold text-[#a33a2b]">2026-27</p>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 py-10 sm:px-8 md:py-14">
        <section className="border-b-2 border-[#20211e] pb-8">
          <p className="font-mono text-xs font-bold uppercase text-[#a33a2b]">{displaySection} / Semester III</p>
          <div className="mt-4 grid gap-7 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
            <div>
              <h1 className="font-display text-4xl font-bold leading-tight sm:text-5xl">{displayName}</h1>
              <p className="mt-2 text-[#62665d]">University roll <span className="font-mono">{student.universityRollNumber}</span></p>
            </div>
            <dl className="grid grid-cols-3 border border-[#20211e]/30 bg-[#fffdf7]">
              <div className="border-r border-[#20211e]/20 px-4 py-3">
                <dt className="text-[10px] font-bold uppercase text-[#73776d]">Course</dt>
                <dd className="mt-1 font-bold">{student.course} {student.branch}</dd>
              </div>
              <div className="border-r border-[#20211e]/20 px-4 py-3">
                <dt className="text-[10px] font-bold uppercase text-[#73776d]">Year</dt>
                <dd className="mt-1 font-bold">Year {student.year}</dd>
              </div>
              <div className="px-4 py-3">
                <dt className="text-[10px] font-bold uppercase text-[#73776d]">Class roll</dt>
                <dd className="mt-1 font-bold">{student.classRollNumber || '-'}</dd>
              </div>
            </dl>
          </div>
        </section>

        <div className="mb-7 mt-10 flex flex-wrap items-baseline justify-between gap-3">
          <div className="flex items-center gap-3">
            <HiOutlineCalendar className="text-2xl text-[#a33a2b]" />
            <h2 className="font-display text-3xl font-bold">Weekly timetable</h2>
          </div>
          {timetable.length ? <p className="text-sm text-[#6b6f65]">{subjectCount} subjects / {teachingEntries.length} sessions</p> : null}
        </div>

        {timetable.length ? (
          <div className="border-t-2 border-[#20211e]">
            {weekdays.map((day) => {
              const entries = timetableByDay.get(day.id) || []
              const teachingDayEntries = entries.filter((entry) => entry.sessionType !== 'Break')
              const classCount = teachingDayEntries.length
              const isDayOff = classCount === 0
              return (
                <section key={day.id} className="grid border-b border-[#20211e]/35 md:grid-cols-[150px_minmax(0,1fr)]">
                  <div className="flex items-baseline justify-between bg-[#e6b845] px-4 py-4 md:block md:py-6">
                    <p className="font-mono text-xs font-black">{day.shortName}</p>
                    <h3 className="mt-1 font-display text-xl font-bold">{day.name}</h3>
                    <p className="mt-3 text-xs md:block">{isDayOff ? 'Day off' : `${classCount} sessions`}</p>
                  </div>
                  {!isDayOff ? (
                    <div className="divide-y divide-[#20211e]/20 bg-[#fffdf7]">
                      {entries.map((entry) => entry.sessionType === 'Break' ? (
                        <article key={entry.id} className="grid gap-3 bg-[#f3dfaa] px-4 py-4 sm:grid-cols-[190px_minmax(0,1fr)_120px] sm:items-center sm:px-6">
                          <div className="flex items-center gap-2 whitespace-nowrap font-mono text-sm font-bold">
                            <HiOutlineClock className="text-lg text-[#a33a2b]" />
                            <span>{formatTime(entry.startTime)} - {formatTime(entry.endTime)}</span>
                          </div>
                          <div className="min-w-0">
                            <p className="font-display text-lg font-bold">Lunch break</p>
                          </div>
                          <div className="text-sm font-medium text-[#6b5b32] sm:text-right">No class scheduled</div>
                        </article>
                      ) : (
                        <article key={entry.id} className="grid gap-3 px-4 py-5 sm:grid-cols-[190px_minmax(0,1fr)_120px] sm:items-center sm:px-6">
                          <div className="flex items-center gap-2 whitespace-nowrap font-mono text-sm font-bold">
                            <HiOutlineClock className="text-lg text-[#a33a2b]" />
                            <span>{formatTime(entry.startTime)} - {formatTime(entry.endTime)}</span>
                          </div>
                          <div className="min-w-0">
                            <div className="mb-1 flex flex-wrap items-center gap-2 text-xs">
                              {entry.subjectCode ? <span className="font-mono font-black text-[#17726a]">{entry.subjectCode}</span> : null}
                              <span className="text-[#73776d]">{entry.sessionType}</span>
                            </div>
                            <p className="font-bold leading-5">{entry.subjectName}</p>
                            {entry.facultyName ? <p className="mt-1 text-sm text-[#6b6f65]">{entry.facultyName}</p> : null}
                          </div>
                          <div className="flex items-center gap-2 font-bold sm:justify-end">
                            <HiOutlineLocationMarker className="text-lg text-[#a33a2b]" />
                            <span>{entry.room ? `Room ${entry.room}` : 'Room not listed'}</span>
                          </div>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <div className="flex items-center bg-[#fffdf7] px-6 py-8">
                      <p className="font-display text-xl font-bold text-[#55594f]">Day off</p>
                    </div>
                  )}
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
          <section className="border-y border-[#20211e] py-8">
            <p className="font-bold">No timetable is available for this section.</p>
            <p className="mt-1 text-sm text-[#6b6f65]">Contact the department for an updated schedule.</p>
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
