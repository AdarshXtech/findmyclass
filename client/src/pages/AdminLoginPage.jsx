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
    <div className="admin-theme relative flex min-h-screen items-center justify-center bg-surface-secondary px-6">
      <div className="absolute inset-0 bg-grid opacity-30" />
      <div className="relative z-10 w-full max-w-md animate-slide-up rounded-2xl border border-border-default bg-surface-primary p-8 shadow-admin">
        <div className="mb-6">
          <Link to="/" className="inline-flex items-center gap-2 text-sm text-text-secondary transition hover:text-text-primary">
            <HiOutlineArrowLeft />
            Back to Student Search
          </Link>
        </div>

        <h1 className="mb-2 text-2xl font-bold text-text-primary">Admin Login</h1>
        <p className="mb-6 text-text-secondary">Sign in to manage students, subjects, and classrooms.</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="admin-username" className="mb-2 block text-sm font-bold text-text-secondary">Username</label>
            <div className="relative">
              <HiOutlineUser className="absolute left-4 top-1/2 -translate-y-1/2 text-accent-primary" />
              <input
                id="admin-username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter your username"
                className="input-field pl-11"
                autoComplete="username"
                required
              />
            </div>
          </div>
          <div>
            <label htmlFor="admin-password" className="mb-2 block text-sm font-bold text-text-secondary">Password</label>
            <div className="relative">
              <HiOutlineLockClosed className="absolute left-4 top-1/2 -translate-y-1/2 text-accent-primary" />
              <input
                id="admin-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                className="input-field pl-11"
                autoComplete="current-password"
                required
              />
            </div>
          </div>

          {error && (
            <div role="alert" className="rounded-xl border border-border-accent bg-surface-danger px-4 py-3 text-sm text-status-danger">
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
