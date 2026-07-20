import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { HiOutlineLockClosed, HiOutlineUser, HiOutlineArrowLeft } from 'react-icons/hi'
import adminApi from '../admin/api'
import { isAdminAuthenticated, setAdminSession } from '../admin/auth'

export default function AdminLoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (isAdminAuthenticated()) {
      navigate('/admin', { replace: true })
    }
  }, [navigate])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (!username.trim() || !password) {
      setError('Username and password are required.')
      return
    }

    setLoading(true)
    try {
      const response = await adminApi.post('/login', {
        username: username.trim(),
        password,
      })
      const payload = response?.data?.data
      if (!payload?.token) {
        setError('Something went wrong. Please try again later.')
        return
      }
      setAdminSession(payload.token, payload.admin)
      const nextPath = location.state?.from || '/admin'
      navigate(nextPath, { replace: true })
    } catch (err) {
      if (err.response?.status === 401) {
        setError('Invalid credentials.')
      } else {
        setError('Something went wrong. Please try again later.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center px-6 bg-navy-900">
      <div className="absolute inset-0 bg-grid opacity-30" />
      <div className="relative z-10 w-full max-w-md glass-card rounded-2xl p-8 animate-slide-up">
        <div className="mb-6">
          <Link to="/" className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white transition">
            <HiOutlineArrowLeft />
            Back to Student Search
          </Link>
        </div>

        <h1 className="text-2xl font-bold text-white mb-2">Admin Login</h1>
        <p className="text-slate-400 mb-6">Sign in to manage students, subjects, and classrooms.</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <HiOutlineUser className="absolute left-4 top-1/2 -translate-y-1/2 text-indigo-400" />
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Username"
              className="input-field pl-11"
              autoComplete="username"
            />
          </div>
          <div className="relative">
            <HiOutlineLockClosed className="absolute left-4 top-1/2 -translate-y-1/2 text-indigo-400" />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              className="input-field pl-11"
              autoComplete="current-password"
            />
          </div>

          {error && (
            <div className="px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-sm text-red-300">
              {error}
            </div>
          )}

          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? 'Signing in...' : 'Login'}
          </button>
        </form>
      </div>
    </div>
  )
}
