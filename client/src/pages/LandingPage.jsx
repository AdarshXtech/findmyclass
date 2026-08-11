import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  HiOutlineAcademicCap,
  HiOutlineArrowRight,
  HiOutlineLocationMarker,
  HiOutlinePhone,
  HiOutlineShieldCheck,
  HiOutlineUser,
} from 'react-icons/hi'
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
    <div className="student-result-theme min-h-screen bg-surface-secondary text-text-primary">
      <header className="border-b border-border-default bg-surface-primary">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-4 px-5 py-4 sm:px-8 lg:px-12 2xl:px-[72px]">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-result-slate-dark text-text-on-dark">
              <HiOutlineAcademicCap className="text-xl" />
            </span>
            <div>
              <p className="font-display text-lg font-bold leading-tight">Find My Class</p>
              <p className="mt-1 font-mono text-xs uppercase tracking-wide text-text-secondary">BBD University</p>
            </div>
          </div>
          <p className="hidden font-mono text-xs font-bold uppercase tracking-wide text-accent-primary sm:block">Academic session 2026-27</p>
        </div>
      </header>

      <main className="mx-auto grid min-h-[calc(100vh-77px)] max-w-[1400px] lg:grid-cols-[minmax(0,1.05fr)_minmax(360px,0.95fr)]">
        <section className="flex min-w-0 items-center px-5 py-10 sm:px-8 sm:py-14 lg:px-12 lg:py-16 2xl:pl-[72px] 2xl:pr-16">
          <div className="w-full max-w-xl">
            <p className="font-mono text-xs font-bold uppercase tracking-wide text-accent-primary">Student timetable access</p>
            <h1 className="mt-4 max-w-lg font-display text-4xl font-bold leading-tight sm:text-5xl lg:text-6xl">Find your next classroom.</h1>
            <p className="mt-5 max-w-lg text-base leading-7 text-text-secondary sm:text-lg">
              Enter the details registered with your class roster to open today&apos;s timetable and room assignment.
            </p>

            <form onSubmit={handleSubmit} aria-busy={loading} className="mt-9 border-t border-border-strong pt-7">
              <div className="grid gap-5">
                <div>
                  <label htmlFor="student-name-input" className="mb-2 block text-sm font-bold">Student name</label>
                  <div className="relative">
                    <HiOutlineUser aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-xl text-text-secondary" />
                    <input
                      id="student-name-input"
                      type="text"
                      value={name}
                      onChange={(event) => { setName(event.target.value); clearError() }}
                      placeholder="For example, Rudransh Kumar Singh"
                      autoComplete="name"
                      autoFocus
                      required
                      className="h-14 w-full rounded-lg border border-border-input bg-surface-primary pl-12 pr-4 text-base font-semibold outline-none transition focus:border-focus focus:ring-2 focus:ring-focus-soft"
                    />
                  </div>
                </div>
                <div>
                  <label htmlFor="student-phone-input" className="mb-2 block text-sm font-bold">Phone number</label>
                  <div className="relative">
                    <HiOutlinePhone aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-xl text-text-secondary" />
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
                      className="h-14 w-full rounded-lg border border-border-input bg-surface-primary pl-12 pr-4 font-mono text-base font-semibold outline-none transition focus:border-focus focus:ring-2 focus:ring-focus-soft"
                    />
                  </div>
                </div>
              </div>

              <div className="mt-5 min-h-12">
                {error ? (
                  <p role="alert" className="rounded-lg border border-result-wine bg-result-wine-soft px-4 py-3 text-sm font-semibold text-result-wine-strong">{error}</p>
                ) : (
                  <p className="flex items-start gap-2 text-sm leading-6 text-text-secondary">
                    <HiOutlineShieldCheck aria-hidden="true" className="mt-0.5 shrink-0 text-lg text-result-slate" />
                    Your full phone number is used only to verify your student record and is never shown on the timetable.
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={loading}
                className="mt-5 flex min-h-14 w-full items-center justify-center gap-3 rounded-lg bg-result-slate px-6 py-3 font-bold text-text-on-dark transition-colors hover:bg-result-slate-hover disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
              >
                <span>{loading ? loadingMessage : 'Open my timetable'}</span>
                {!loading ? <HiOutlineArrowRight aria-hidden="true" className="text-xl" /> : null}
              </button>
            </form>

            <div className="mt-9 flex min-w-0 items-center gap-3 border-t border-border-default pt-5 text-sm text-text-secondary">
              <HiOutlineLocationMarker aria-hidden="true" className="shrink-0 text-xl text-accent-primary" />
              <span>School of Engineering, BBD University, Lucknow</span>
            </div>
          </div>
        </section>

        <aside className="min-w-0 bg-result-slate-dark p-5 text-text-on-dark sm:p-8 lg:flex lg:flex-col lg:justify-end lg:p-10 2xl:pr-[72px]">
          <figure className="min-w-0">
            <img
              src="/bbdu-campus.webp"
              alt="Babu Banarasi Das University campus building in Lucknow"
              className="h-56 w-full rounded-lg object-cover object-top sm:h-80 lg:h-[420px]"
            />
            <figcaption className="mt-6">
              <p className="font-mono text-xs font-bold uppercase tracking-wide text-result-subtle">BBDU / Lucknow</p>
              <h2 className="mt-3 max-w-md font-display text-2xl font-bold leading-tight sm:text-3xl">Babu Banarasi Das University</h2>
              <p className="mt-3 max-w-lg text-sm leading-6 text-result-subtle">
                BBD City, Faizabad Road, Lucknow. Timetable information follows the School of Engineering&apos;s issued class schedule.
              </p>
            </figcaption>
          </figure>
          <p className="mt-8 border-t border-border-inverse pt-4 font-mono text-xs uppercase tracking-wide text-result-subtle">Academic session 2026-27</p>
        </aside>
      </main>
    </div>
  )
}
