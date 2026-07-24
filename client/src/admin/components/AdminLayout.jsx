import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  HiOutlineBookOpen,
  HiOutlineLocationMarker,
  HiOutlineLogout,
  HiOutlineMenuAlt3,
  HiOutlineOfficeBuilding,
  HiOutlineUpload,
  HiOutlineUsers,
  HiOutlineViewGrid,
  HiOutlineX,
} from 'react-icons/hi'
import { clearAdminSession, getAdminUser } from '../auth'

const navItems = [
  { to: '/admin', label: 'Dashboard', icon: HiOutlineViewGrid },
  { to: '/admin/students', label: 'Students', icon: HiOutlineUsers },
  { to: '/admin/subjects', label: 'Subjects', icon: HiOutlineBookOpen },
  { to: '/admin/classrooms', label: 'Classrooms', icon: HiOutlineOfficeBuilding },
  { to: '/admin/import', label: 'Import Students', icon: HiOutlineUpload },
]

export default function AdminLayout() {
  const navigate = useNavigate()
  const admin = getAdminUser()
  const [navigationOpen, setNavigationOpen] = useState(false)

  useEffect(() => {
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setNavigationOpen(false)
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [])

  const handleLogout = () => {
    clearAdminSession()
    navigate('/admin/login', { replace: true })
  }

  return (
    <div className="admin-theme min-h-screen bg-surface-secondary text-text-primary">
      <header className="border-b border-border-default bg-surface-primary">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <Link to="/admin" className="inline-flex min-w-0 items-center gap-2 font-semibold">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center bg-surface-inverse text-text-on-dark">
              <HiOutlineLocationMarker />
            </span>
            <span className="hidden truncate sm:inline">Smart Classroom Locator Admin</span>
            <span className="sm:hidden">Admin</span>
          </Link>
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <span className="hidden text-sm text-text-secondary md:inline">
              Logged in as <span className="text-text-primary">{admin?.username || 'Admin'}</span>
            </span>
            <button
              onClick={handleLogout}
              className="inline-flex h-11 w-11 items-center justify-center border border-border-strong transition hover:bg-surface-muted sm:w-auto sm:gap-2 sm:px-3"
              aria-label="Log out"
              title="Log out"
            >
              <HiOutlineLogout />
              <span className="hidden sm:inline">Logout</span>
            </button>
            <button
              type="button"
              onClick={() => setNavigationOpen((open) => !open)}
              className="inline-flex h-11 w-11 items-center justify-center border border-border-strong transition hover:bg-surface-muted lg:hidden"
              aria-label={navigationOpen ? 'Close admin navigation' : 'Open admin navigation'}
              aria-expanded={navigationOpen}
              aria-controls="admin-navigation"
              title={navigationOpen ? 'Close navigation' : 'Open navigation'}
            >
              {navigationOpen ? <HiOutlineX className="text-xl" /> : <HiOutlineMenuAlt3 className="text-xl" />}
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[260px_minmax(0,1fr)]">
        <div
          id="admin-navigation"
          className={`${navigationOpen ? 'grid grid-rows-[1fr]' : 'hidden'} lg:block`}
        >
          <div className="overflow-hidden lg:overflow-visible">
            <aside className="h-max border border-border-default bg-surface-primary p-3 shadow-admin">
              <nav aria-label="Admin navigation" className="space-y-1">
                {navItems.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.to === '/admin'}
                    onClick={() => setNavigationOpen(false)}
                    className={({ isActive }) =>
                      `flex min-h-11 items-center gap-3 border px-3 py-2 transition ${
                        isActive
                          ? 'border-border-strong bg-accent-highlight text-text-primary'
                          : 'border-transparent text-text-secondary hover:bg-surface-muted hover:text-text-primary'
                      }`
                    }
                  >
                    <item.icon className="shrink-0" />
                    <span>{item.label}</span>
                  </NavLink>
                ))}
              </nav>
            </aside>
          </div>
        </div>

        <main className="min-w-0">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
