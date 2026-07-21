import { useEffect, useMemo, useState } from 'react'
import { HiOutlineBookOpen, HiOutlineOfficeBuilding, HiOutlineUsers, HiOutlineViewGrid } from 'react-icons/hi'
import { useNavigate } from 'react-router-dom'
import adminApi from '../admin/api'
import { clearAdminSession } from '../admin/auth'

const cards = [
  { key: 'totalStudents', title: 'Students', icon: HiOutlineUsers },
  { key: 'totalSubjects', title: 'Subjects', icon: HiOutlineBookOpen },
  { key: 'totalClassrooms', title: 'Assignments', icon: HiOutlineOfficeBuilding },
  { key: 'totalSections', title: 'Sections', icon: HiOutlineViewGrid },
]

export default function AdminDashboardPage() {
  const navigate = useNavigate()
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchStats()
  }, [])

  const sectionMaxCount = useMemo(() => {
    if (!stats?.sectionWise?.length) {
      return 1
    }
    return Math.max(...stats.sectionWise.map((item) => Number(item.count) || 0), 1)
  }, [stats])

  const fetchStats = async () => {
    setLoading(true)
    setError('')
    try {
      const response = await adminApi.get('/stats')
      setStats(response.data.data)
    } catch (err) {
      if (err.response?.status === 401 || err.response?.status === 403) {
        clearAdminSession()
        navigate('/admin/login', { replace: true })
        return
      }
      setError('Failed to load dashboard statistics. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <section className="glass-card rounded-2xl p-6 sm:p-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">Admin Dashboard</h1>
        <p className="text-slate-400">Live overview of students, sections, subjects, and room assignments.</p>
      </section>

      {error ? (
        <section className="glass-card rounded-2xl p-6">
          <p className="text-red-300 text-sm">{error}</p>
        </section>
      ) : null}

      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {cards.map((card) => (
          <article key={card.key} className="glass-card rounded-2xl p-5">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/20 text-indigo-300 flex items-center justify-center mb-3">
              <card.icon className="text-xl" />
            </div>
            <h2 className="text-sm text-slate-400 mb-1">{card.title}</h2>
            <p className="text-2xl font-bold text-white">
              {loading ? '...' : stats?.[card.key] ?? 0}
            </p>
          </article>
        ))}
      </section>

      <section className="glass-card rounded-2xl p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Students by Section</h2>
        {loading ? (
          <p className="text-slate-400">Loading section distribution...</p>
        ) : !stats?.sectionWise?.length ? (
          <p className="text-slate-400">No section data available.</p>
        ) : (
          <div className="space-y-3">
            {stats.sectionWise.map((item) => {
              const count = Number(item.count) || 0
              const width = Math.max((count / sectionMaxCount) * 100, 4)
              return (
                <div key={item.section}>
                  <div className="flex items-center justify-between mb-1 text-sm">
                    <span className="text-slate-200 font-medium">{item.section}</span>
                    <span className="text-slate-400">{count}</span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
                    <div className="h-full bg-orange-600" style={{ width: `${width}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
