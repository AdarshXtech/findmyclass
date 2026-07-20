import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { HiOutlinePhone, HiOutlineSearch, HiOutlineLocationMarker, HiOutlineAcademicCap } from 'react-icons/hi'
import { HiSparkles } from 'react-icons/hi2'
import { normalizePhone, isValidPhone } from '../utils/phone'

export default function LandingPage() {
  const [phone, setPhone] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const handleSubmit = (e) => {
    e.preventDefault()
    setError('')

    // Validate phone number
    const cleanPhone = normalizePhone(phone)
    if (!cleanPhone) {
      setError('Please enter your phone number.')
      return
    }
    if (!isValidPhone(cleanPhone)) {
      setError('Please enter a valid 10-digit phone number.')
      return
    }

    setLoading(true)
    // Navigate to result page — the API call happens there
    setTimeout(() => {
      navigate(`/result/${cleanPhone}`)
    }, 400)
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* ── Animated Background ───────────────────────────── */}
      <div className="absolute inset-0 bg-navy-900">
        {/* Gradient orbs */}
        <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full bg-indigo-600/20 blur-[120px] animate-float" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] rounded-full bg-sky-500/15 blur-[100px] animate-float" style={{ animationDelay: '3s' }} />
        <div className="absolute top-[40%] right-[20%] w-[300px] h-[300px] rounded-full bg-violet-600/10 blur-[80px] animate-float" style={{ animationDelay: '1.5s' }} />
        {/* Grid pattern */}
        <div className="absolute inset-0 bg-grid opacity-50" />
      </div>

      {/* ── Content ───────────────────────────────────────── */}
      <div className="relative z-10 w-full max-w-lg mx-auto px-6 py-12">

        {/* Logo & Badge */}
        <div className="text-center mb-8 animate-slide-up">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass-light mb-6">
            <HiSparkles className="text-indigo-400 text-sm" />
            <span className="text-xs font-medium text-indigo-300 tracking-wider uppercase">QR-Based Campus Navigation</span>
          </div>

          {/* Icon */}
          <div className="mx-auto w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center mb-6 shadow-lg shadow-indigo-500/30">
            <HiOutlineLocationMarker className="text-4xl text-white" />
          </div>

          {/* Title */}
          <h1 className="text-4xl sm:text-5xl font-bold mb-3">
            <span className="gradient-text">Smart Classroom</span>
            <br />
            <span className="text-white">Locator</span>
          </h1>

          {/* Subtitle */}
          <p className="text-slate-400 text-lg max-w-sm mx-auto leading-relaxed">
            Find your classroom in seconds.<br/>
            Enter your registered phone number below.
          </p>
        </div>

        {/* ── Search Card ──────────────────────────────────── */}
        <div className="glass-card rounded-2xl p-8 animate-slide-up stagger-2">
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Phone Input */}
            <div className="relative">
              <HiOutlinePhone className="absolute left-4 top-1/2 -translate-y-1/2 text-xl text-indigo-400" />
              <input
                id="phone-input"
                type="tel"
                value={phone}
                onChange={(e) => {
                  setPhone(e.target.value)
                  if (error) setError('')
                }}
                placeholder="Enter your phone number"
                className="input-field pl-12"
                maxLength={15}
                autoComplete="tel"
                autoFocus
              />
            </div>

            {/* Error Message */}
            {error && (
              <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 animate-scale-in">
                <svg className="w-5 h-5 text-red-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-red-300 text-sm font-medium">{error}</p>
              </div>
            )}

            {/* Submit Button */}
            <button
              id="find-classroom-btn"
              type="submit"
              disabled={loading}
              className="btn-primary w-full flex items-center justify-center gap-3"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                  </svg>
                  <span>Searching...</span>
                </>
              ) : (
                <>
                  <HiOutlineSearch className="text-xl" />
                  <span>Find My Classroom</span>
                </>
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-4 mt-6 mb-4">
            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-slate-600 to-transparent" />
            <span className="text-xs text-slate-500 uppercase tracking-widest">How it works</span>
            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-slate-600 to-transparent" />
          </div>

          {/* Steps */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { icon: '📱', label: 'Scan QR Code' },
              { icon: '📞', label: 'Enter Phone' },
              { icon: '🏫', label: 'Find Room' },
            ].map((step, i) => (
              <div key={i} className="text-center p-3 rounded-xl glass-light hover:border-indigo-500/30 transition-all duration-300">
                <div className="text-2xl mb-1">{step.icon}</div>
                <p className="text-xs text-slate-400 font-medium">{step.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── Footer ───────────────────────────────────────── */}
        <div className="text-center mt-8 animate-fade-in stagger-4">
          <div className="flex items-center justify-center gap-2 text-slate-500 text-sm">
            <HiOutlineAcademicCap className="text-lg" />
            <span>Smart Classroom Locator © {new Date().getFullYear()}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
