import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { HiOutlineAcademicCap, HiOutlineArrowRight, HiOutlinePhone, HiOutlineUser } from 'react-icons/hi'
import { lookupStudentSchedule } from '../api/publicApi'
import { normalizePhoneNumber, normalizeStudentName } from '../utils/studentIdentity'

export default function LandingPage() {
  const [name, setName] = useState('')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingMessage, setLoadingMessage] = useState('Checking student details...')
  const navigate = useNavigate()

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')

    const cleanName = normalizeStudentName(name)
    const cleanPhoneNumber = normalizePhoneNumber(phoneNumber)
    if (!cleanName || !phoneNumber.trim()) {
      setError('Enter your full name and phone number.')
      return
    }
    if (!cleanPhoneNumber) {
      setError('Enter a valid 10-digit phone number.')
      return
    }

    setLoading(true)
    setLoadingMessage('Checking student details...')
    const wakeMessageTimer = window.setTimeout(() => {
      setLoadingMessage('Waking the free server...')
    }, 6000)

    try {
      const response = await lookupStudentSchedule(
        { name: cleanName, phoneNumber: cleanPhoneNumber },
        { onRetry: () => setLoadingMessage('Server is awake. Retrying...') }
      )
      navigate('/result', { state: { lookupData: response.data.data } })
    } catch (requestError) {
      setError(
        requestError.response?.data?.message
        || 'The schedule service is unavailable right now. Try again in a moment.'
      )
    } finally {
      window.clearTimeout(wakeMessageTimer)
      setLoading(false)
    }
  }

  const clearError = () => {
    if (error) setError('')
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
          <p className="mb-5 font-mono text-xs font-bold uppercase text-[#a33a2b]">School of Engineering / CSAI</p>
          <div className="max-w-3xl">
            <h1 className="font-display text-5xl font-bold leading-[0.98] sm:text-6xl md:text-7xl">BBDU timetable</h1>
            <p className="mt-6 max-w-xl text-lg leading-7 text-[#55594f]">
              View the timetable assigned to your class. Verify your student details to open today&apos;s schedule.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="mt-10 max-w-3xl border-y border-[#20211e] py-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="student-name-input" className="mb-2 block text-sm font-bold">Student name</label>
                <div className="relative">
                  <HiOutlineUser className="absolute left-4 top-1/2 -translate-y-1/2 text-xl text-[#6b6f65]" />
                  <input
                    id="student-name-input"
                    type="text"
                    value={name}
                    onChange={(event) => { setName(event.target.value); clearError() }}
                    placeholder="Full name"
                    autoComplete="name"
                    autoFocus
                    required
                    className="h-14 w-full border border-[#868a80] bg-[#fffdf7] pl-12 pr-4 text-base font-semibold outline-none transition focus:border-[#a33a2b] focus:ring-2 focus:ring-[#a33a2b]/20"
                  />
                </div>
              </div>
              <div>
                <label htmlFor="student-phone-input" className="mb-2 block text-sm font-bold">Phone number</label>
                <div className="relative">
                  <HiOutlinePhone className="absolute left-4 top-1/2 -translate-y-1/2 text-xl text-[#6b6f65]" />
                  <input
                    id="student-phone-input"
                    type="tel"
                    inputMode="tel"
                    value={phoneNumber}
                    onChange={(event) => { setPhoneNumber(event.target.value); clearError() }}
                    placeholder="10-digit number"
                    autoComplete="tel"
                    maxLength={18}
                    required
                    className="h-14 w-full border border-[#868a80] bg-[#fffdf7] pl-12 pr-4 font-mono text-base font-semibold outline-none transition focus:border-[#a33a2b] focus:ring-2 focus:ring-[#a33a2b]/20"
                  />
                </div>
              </div>
            </div>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-h-5">
                {error ? (
                  <p role="alert" className="border-l-4 border-[#a33a2b] pl-3 text-sm font-medium text-[#842d22]">{error}</p>
                ) : (
                  <p className="text-sm text-[#6b6f65]">Both details must match the same student record.</p>
                )}
              </div>
              <button
                type="submit"
                disabled={loading}
                className="flex h-14 shrink-0 items-center justify-center gap-3 bg-[#a33a2b] px-6 font-bold text-white transition hover:bg-[#842d22] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <span>{loading ? loadingMessage : 'Open my timetable'}</span>
                {!loading ? <HiOutlineArrowRight className="text-xl" /> : null}
              </button>
            </div>
          </form>
        </section>

        <section className="bg-[#20211e] text-[#f3efe5]">
          <div className="mx-auto grid max-w-6xl gap-8 px-5 py-6 sm:px-8 md:grid-cols-[220px_minmax(0,1fr)] md:items-start md:py-8">
            <div className="md:pt-5">
              <p className="font-mono text-xs font-bold uppercase text-[#e7b949]">BBDU / Lucknow</p>
              <h2 className="mt-3 font-display text-3xl font-bold leading-tight">Babu Banarasi Das University.</h2>
              <p className="mt-4 text-sm leading-6 text-[#babdb4]">
                Located at BBD City on Ayodhya Road, BBDU is a state private university focused on teaching, learning and research across a multidisciplinary campus.
              </p>
            </div>
            <figure className="border border-[#f3efe5]/30 bg-white p-2 shadow-[10px_10px_0_#a33a2b]">
              <img src="/bbdu-campus.webp" alt="Babu Banarasi Das University campus building in Lucknow" className="h-64 w-full object-cover object-top sm:h-80 md:h-[420px]" />
              <figcaption className="bg-white px-2 pb-1 pt-3 text-xs text-[#55594f]">Babu Banarasi Das University / Lucknow</figcaption>
            </figure>
          </div>
        </section>
      </main>

      <footer className="bg-[#20211e] px-5 pb-8 pt-2 text-center text-xs text-[#8f9389]">Academic session 2026-27 / Semester III</footer>
    </div>
  )
}
