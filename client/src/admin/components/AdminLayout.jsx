import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { HiOutlineViewGrid, HiOutlineUsers, HiOutlineBookOpen, HiOutlineOfficeBuilding, HiOutlineUpload, HiOutlineLogout, HiOutlineLocationMarker } from 'react-icons/hi'
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

  const handleLogout = () => {
    clearAdminSession()
    navigate('/admin/login', { replace: true })
  }

  return (
    <div className="min-h-screen bg-navy-900 text-slate-200">
      <header className="border-b border-indigo-500/20 bg-navy-800/80 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-4">
          <Link to="/admin" className="inline-flex items-center gap-2 text-white font-semibold">
            <span className="w-9 h-9 rounded-md bg-orange-700 flex items-center justify-center">
              <HiOutlineLocationMarker />
            </span>
            <span>Smart Classroom Locator Admin</span>
          </Link>
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-400 hidden sm:inline">
              Logged in as <span className="text-slate-200">{admin?.username || 'Admin'}</span>
            </span>
            <button
              onClick={handleLogout}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-600 hover:border-indigo-400 hover:text-white transition"
            >
              <HiOutlineLogout />
              Logout
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-6">
        <aside className="glass-card rounded-2xl p-4 h-max">
          <nav className="space-y-2">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/admin'}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2 rounded-lg transition ${
                    isActive ? 'bg-indigo-500/20 text-white border border-indigo-500/30' : 'text-slate-300 hover:bg-white/5'
                  }`
                }
              >
                <item.icon />
                <span>{item.label}</span>
              </NavLink>
            ))}
          </nav>
        </aside>

        <main className="min-w-0">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
