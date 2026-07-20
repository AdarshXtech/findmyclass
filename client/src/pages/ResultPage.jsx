import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  HiOutlineLocationMarker,
  HiOutlineArrowLeft,
  HiOutlineUser,
  HiOutlineAcademicCap,
  HiOutlineBookOpen,
  HiOutlineOfficeBuilding,
} from 'react-icons/hi'
import { HiBuildingOffice2 } from 'react-icons/hi2'
import { normalizePhone, isValidPhone } from '../utils/phone'
import publicApi from '../api/publicApi'

export default function ResultPage() {
  const { phone } = useParams()
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    lookupStudent()
  }, [phone])

  const lookupStudent = async () => {
    setLoading(true)
    setError('')
    const cleanPhone = normalizePhone(phone)

    if (!isValidPhone(cleanPhone)) {
      setError('Please enter a valid 10-digit phone number.')
      setLoading(false)
      return
    }

    try {
      const response = await publicApi.post('/student/lookup', { phone: cleanPhone })
      if (response.data.success) {
        setData(response.data.data)
      }
    } catch (err) {
      if (err.response?.status === 404) {
        setError('No student found. Please enter your registered phone number.')
      } else {
        setError('Something went wrong. Please try again later.')
      }
    } finally {
      setLoading(false)
    }
  }

  const getYearSuffix = (year) => {
    const suffixes = { 1: 'st', 2: 'nd', 3: 'rd' }
    return `${year}${suffixes[year] || 'th'} Year`
  }

  const getWingColor = (wing) => {
    const colors = {
      A: { bg: 'from-emerald-500/20 to-emerald-600/10', text: 'text-emerald-400', border: 'border-emerald-500/20', badge: 'bg-emerald-500/20 text-emerald-300' },
      B: { bg: 'from-sky-500/20 to-sky-600/10', text: 'text-sky-400', border: 'border-sky-500/20', badge: 'bg-sky-500/20 text-sky-300' },
      C: { bg: 'from-amber-500/20 to-amber-600/10', text: 'text-amber-400', border: 'border-amber-500/20', badge: 'bg-amber-500/20 text-amber-300' },
    }
    return colors[wing] || colors.A
  }

  // ── Loading State ──────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-navy-900">
        <div className="text-center animate-fade-in">
          <div className="relative mx-auto w-20 h-20 mb-6">
            <div className="absolute inset-0 rounded-full border-4 border-indigo-500/20"></div>
            <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-indigo-500 animate-spin"></div>
            <HiOutlineLocationMarker className="absolute inset-0 m-auto text-3xl text-indigo-400" />
          </div>
          <p className="text-slate-400 font-medium">Locating your classrooms...</p>
        </div>
      </div>
    )
  }

  // ── Error State ────────────────────────────────────────
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-navy-900 px-6">
        <div className="absolute inset-0 bg-grid opacity-30" />
        <div className="relative glass-card rounded-2xl p-10 max-w-md w-full text-center animate-scale-in">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-red-500/10 flex items-center justify-center mb-6">
            <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-white mb-3">Not Found</h2>
          <p className="text-slate-400 mb-8 leading-relaxed">{error}</p>
          <button
            onClick={() => navigate('/')}
            className="btn-primary inline-flex items-center gap-2"
          >
            <HiOutlineArrowLeft className="text-lg" />
            Try Again
          </button>
        </div>
      </div>
    )
  }

  const { student, classrooms } = data

  // ── Success State ──────────────────────────────────────
  return (
    <div className="min-h-screen bg-navy-900 relative">
      {/* Background */}
      <div className="absolute inset-0">
        <div className="absolute top-0 left-[-10%] w-[500px] h-[500px] rounded-full bg-indigo-600/10 blur-[120px]" />
        <div className="absolute bottom-0 right-[-10%] w-[400px] h-[400px] rounded-full bg-violet-600/10 blur-[100px]" />
        <div className="absolute inset-0 bg-grid opacity-30" />
      </div>

      <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 py-8">

        {/* ── Back Button ──────────────────────────────────── */}
        <button
          id="back-btn"
          onClick={() => navigate('/')}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl glass-light text-slate-300 hover:text-white hover:border-indigo-500/30 transition-all duration-300 mb-6 animate-fade-in"
        >
          <HiOutlineArrowLeft />
          <span className="text-sm font-medium">Search Again</span>
        </button>

        {/* ── Student Profile Card ─────────────────────────── */}
        <div className="glass-card rounded-2xl p-6 sm:p-8 mb-8 animate-slide-up">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
            {/* Avatar */}
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center flex-shrink-0 shadow-lg shadow-indigo-500/25">
              <span className="text-2xl sm:text-3xl font-bold text-white">
                {student.name.charAt(0)}
              </span>
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl sm:text-3xl font-bold text-white mb-1">
                Welcome, {student.name.split(' ')[0]}! 👋
              </h1>
              <p className="text-slate-400 text-sm sm:text-base">
                Here are your classroom details for this semester
              </p>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6">
            {[
              { icon: HiOutlineAcademicCap, label: 'Course', value: `${student.course} ${student.branch}` },
              { icon: HiOutlineBookOpen, label: 'Year', value: getYearSuffix(student.year) },
              { icon: HiOutlineUser, label: 'Section', value: student.section },
              { icon: HiBuildingOffice2, label: 'Subjects', value: `${classrooms.length} Classes` },
            ].map((item, i) => (
              <div key={i} className="glass-light rounded-xl p-4 text-center hover:border-indigo-500/20 transition-all duration-300">
                <item.icon className="mx-auto text-xl text-indigo-400 mb-2" />
                <p className="text-xs text-slate-500 mb-1">{item.label}</p>
                <p className="text-sm font-semibold text-white truncate">{item.value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── Section Title ────────────────────────────────── */}
        <div className="flex items-center gap-3 mb-5 animate-slide-up stagger-2">
          <HiOutlineLocationMarker className="text-2xl text-indigo-400" />
          <h2 className="text-xl font-bold text-white">Your Classroom Locations</h2>
          <div className="flex-1 h-px bg-gradient-to-r from-indigo-500/30 to-transparent" />
        </div>

        {/* ── Classroom Cards Grid ─────────────────────────── */}
        {classrooms.length === 0 ? (
          <div className="glass-card rounded-2xl p-8 text-center animate-slide-up">
            <p className="text-white font-semibold mb-2">No classroom assignments available yet.</p>
            <p className="text-slate-400 text-sm">Please contact your department for updated room allocation.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {classrooms.map((classroom, index) => {
              const wingColor = getWingColor(classroom.wing)
              return (
                <div
                  key={classroom.id}
                  className={`glass-card rounded-2xl p-5 sm:p-6 animate-slide-up opacity-0 hover:border-indigo-500/30 transition-all duration-300 hover:-translate-y-1`}
                  style={{ animationDelay: `${0.15 * (index + 1)}s`, animationFillMode: 'forwards' }}
                >
                  {/* Subject Header */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${wingColor.bg} flex items-center justify-center`}>
                        <HiOutlineBookOpen className={`text-xl ${wingColor.text}`} />
                      </div>
                      <div>
                        <h3 className="font-bold text-white text-lg leading-tight">{classroom.subject}</h3>
                      </div>
                    </div>
                    <span className={`px-3 py-1 rounded-lg text-xs font-bold ${wingColor.badge}`}>
                      Wing {classroom.wing}
                    </span>
                  </div>

                  {/* Details */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="glass-light rounded-xl p-3 text-center">
                      <HiOutlineOfficeBuilding className="mx-auto text-lg text-slate-400 mb-1" />
                      <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-0.5">Floor</p>
                      <p className="text-sm font-semibold text-white">{classroom.floor}</p>
                    </div>
                    <div className="glass-light rounded-xl p-3 text-center">
                      <HiBuildingOffice2 className="mx-auto text-lg text-slate-400 mb-1" />
                      <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-0.5">Wing</p>
                      <p className="text-sm font-semibold text-white">{classroom.wing} Wing</p>
                    </div>
                    <div className="glass-light rounded-xl p-3 text-center">
                      <HiOutlineLocationMarker className="mx-auto text-lg text-indigo-400 mb-1" />
                      <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-0.5">Room</p>
                      <p className="text-sm font-bold text-indigo-300">{classroom.room}</p>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* ── Footer Note ──────────────────────────────────── */}
        <div className="text-center mt-10 mb-6 animate-fade-in stagger-6">
          <p className="text-sm text-slate-500">
            Room assignments may change. Contact your department for the latest updates.
          </p>
          <div className="flex items-center justify-center gap-2 mt-3 text-slate-600 text-xs">
            <HiOutlineAcademicCap />
            <span>Smart Classroom Locator © {new Date().getFullYear()}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
