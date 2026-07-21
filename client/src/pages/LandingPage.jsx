import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { HiOutlineAcademicCap, HiOutlineArrowRight, HiOutlineIdentification } from 'react-icons/hi'
import publicApi from '../api/publicApi'
import { isValidUniversityRollNumber, normalizeUniversityRollNumber } from '../utils/universityRoll'

export default function LandingPage() {
  const [universityRollNumber, setUniversityRollNumber] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')

    const cleanRollNumber = normalizeUniversityRollNumber(universityRollNumber)
    if (!cleanRollNumber) {
      setError('Enter your university roll number.')
      return
    }
    if (!isValidUniversityRollNumber(cleanRollNumber)) {
      setError('That university roll number does not look valid.')
      return
    }

    setLoading(true)
    try {
      const response = await publicApi.post('/student/lookup', {
        university_roll_number: cleanRollNumber,
      })
      navigate(`/result/${encodeURIComponent(cleanRollNumber)}`, {
        state: { universityRollNumber: cleanRollNumber, lookupData: response.data.data },
      })
    } catch (requestError) {
      if (requestError.response?.status === 404) {
        setError('No CSAI 2B student was found with that university roll number.')
      } else if (requestError.response?.data?.message) {
        setError(requestError.response.data.message)
      } else {
        setError('The schedule service is unavailable right now. Try again in a moment.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#f3efe5] text-[#20211e]">
      <header className="border-b border-[#20211e]/20">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center bg-[#20211e] text-[#f3efe5]">
              <HiOutlineAcademicCap className="text-xl" />
            </span>
            <div>
              <p className="font-display text-lg font-bold leading-none">Find My Class</p>
              <p className="mt-1 font-mono text-[11px] uppercase text-[#5d6259]">BBD University</p>
            </div>
          </div>
          <p className="hidden font-mono text-sm text-[#5d6259] sm:block">Odd semester / 2026-27</p>
        </div>
      </header>

      <main>
        <section className="mx-auto max-w-6xl px-5 pb-12 pt-12 sm:px-8 md:pb-16 md:pt-20">
          <p className="mb-5 font-mono text-xs font-bold uppercase text-[#a33a2b]">School of Engineering / CSAI 2B</p>
          <div className="max-w-3xl">
            <h1 className="font-display text-5xl font-bold leading-[0.98] sm:text-6xl md:text-7xl">
              CSAI 2B timetable
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-7 text-[#55594f]">
              Your weekly classes, faculty and room numbers from the department timetable. Search with the roll number printed on the class roster.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="mt-10 max-w-3xl border-y border-[#20211e] py-6">
            <label htmlFor="university-roll-input" className="mb-3 block text-sm font-bold">
              University roll number
            </label>
            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
              <div className="relative">
                <HiOutlineIdentification className="absolute left-4 top-1/2 -translate-y-1/2 text-xl text-[#6b6f65]" />
                <input
                  id="university-roll-input"
                  type="text"
                  value={universityRollNumber}
                  onChange={(event) => {
                    setUniversityRollNumber(event.target.value)
                    if (error) setError('')
                  }}
                  placeholder="e.g. 1250439358"
                  maxLength={30}
                  autoFocus
                  required
                  aria-describedby={error ? 'roll-number-error' : 'roll-number-hint'}
                  className="h-14 w-full border border-[#868a80] bg-[#fffdf7] pl-12 pr-4 font-mono text-lg font-semibold outline-none transition focus:border-[#a33a2b] focus:ring-2 focus:ring-[#a33a2b]/20"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="flex h-14 items-center justify-center gap-3 bg-[#a33a2b] px-6 font-bold text-white transition hover:bg-[#842d22] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <span>{loading ? 'Checking roster...' : 'Open my timetable'}</span>
                {!loading ? <HiOutlineArrowRight className="text-xl" /> : null}
              </button>
            </div>
            {error ? (
              <p id="roll-number-error" role="alert" className="mt-3 border-l-4 border-[#a33a2b] pl-3 text-sm font-medium text-[#842d22]">
                {error}
              </p>
            ) : (
              <p id="roll-number-hint" className="mt-3 text-sm text-[#6b6f65]">58 students are listed in the current roster.</p>
            )}
          </form>
        </section>

        <section className="bg-[#20211e] text-[#f3efe5]">
          <div className="mx-auto grid max-w-6xl gap-8 px-5 py-6 sm:px-8 md:grid-cols-[220px_minmax(0,1fr)] md:items-start md:py-8">
            <div className="md:pt-5">
              <p className="font-mono text-xs font-bold uppercase text-[#e7b949]">Source sheet</p>
              <h2 className="mt-3 font-display text-3xl font-bold leading-tight">The department timetable, made searchable.</h2>
              <p className="mt-4 text-sm leading-6 text-[#babdb4]">
                Rooms and times follow the timetable issued for B.Tech second year. Tuesday is intentionally blank.
              </p>
            </div>
            <figure className="border border-[#f3efe5]/30 bg-white p-2 shadow-[10px_10px_0_#a33a2b]">
              <img
                src="/csai2b-timetable.jpeg"
                alt="Original CSAI 2B department timetable for academic session 2026-27"
                className="h-64 w-full object-cover object-top sm:h-80 md:h-[420px]"
              />
              <figcaption className="bg-white px-2 pb-1 pt-3 text-xs text-[#55594f]">
                Department of Computer Science and Engineering / issued timetable
              </figcaption>
            </figure>
          </div>
        </section>
      </main>

      <footer className="bg-[#20211e] px-5 pb-8 pt-2 text-center text-xs text-[#8f9389]">
        Academic session 2026-27 / Semester III
      </footer>
    </div>
  )
}
