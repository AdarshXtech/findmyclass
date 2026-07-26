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
      <section className="rounded-2xl border border-border-default bg-surface-primary p-6 shadow-admin sm:p-8">
        <h1 className="mb-2 text-2xl font-bold text-text-primary sm:text-3xl">Admin Dashboard</h1>
        <p className="text-text-secondary">Live overview of students, sections, subjects, and room assignments.</p>
      </section>

      {error ? (
        <section className="rounded-2xl border border-border-default bg-surface-primary p-6 shadow-admin">
          <p className="text-sm text-status-danger">{error}</p>
        </section>
      ) : null}

      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {cards.map((card) => (
          <article key={card.key} className="rounded-2xl border border-border-default bg-surface-primary p-5 shadow-admin">
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-surface-highlight text-accent-primary">
              <card.icon className="text-xl" />
            </div>
            <h2 className="mb-1 text-sm text-text-secondary">{card.title}</h2>
            <p className="text-2xl font-bold text-text-primary">
              {loading ? '...' : stats?.[card.key] ?? 0}
            </p>
          </article>
        ))}
      </section>

      <section className="rounded-2xl border border-border-default bg-surface-primary p-6 shadow-admin">
        <h2 className="mb-4 text-lg font-semibold text-text-primary">Students by Section</h2>
        {loading ? (
          <p className="text-text-secondary">Loading section distribution...</p>
        ) : !stats?.sectionWise?.length ? (
          <p className="text-text-secondary">No section data available.</p>
        ) : (
          <div className="space-y-3">
            {stats.sectionWise.map((item) => {
              const count = Number(item.count) || 0
              const width = Math.max((count / sectionMaxCount) * 100, 4)
              return (
                <div key={item.section}>
                  <div className="flex items-center justify-between mb-1 text-sm">
                    <span className="font-medium text-text-primary">{item.section}</span>
                    <span className="text-text-secondary">{count}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-border-default">
                    <div className="h-full bg-accent-highlight" style={{ width: `${width}%` }} />
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
