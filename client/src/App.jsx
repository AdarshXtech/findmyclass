import { lazy, Suspense } from 'react'
import { Navigate, Routes, Route } from 'react-router-dom'
import LandingPage from './pages/LandingPage'
import ResultPage from './pages/ResultPage'
import NotFoundPage from './pages/NotFoundPage'
import PageLoadingState from './components/PageLoadingState'

const AdminLoginPage = lazy(() => import('./pages/AdminLoginPage'))
const AdminDashboardPage = lazy(() => import('./pages/AdminDashboardPage'))
const AdminStudentsPage = lazy(() => import('./pages/AdminStudentsPage'))
const AdminSubjectsPage = lazy(() => import('./pages/AdminSubjectsPage'))
const AdminClassroomsPage = lazy(() => import('./pages/AdminClassroomsPage'))
const AdminImportPage = lazy(() => import('./pages/AdminImportPage'))
const AdminTimetablePage = lazy(() => import('./pages/AdminTimetablePage'))
const AdminPathsPage = lazy(() => import('./pages/AdminPathsPage'))
const ProtectedRoute = lazy(() => import('./admin/components/ProtectedRoute'))
const AdminLayout = lazy(() => import('./admin/components/AdminLayout'))

function App() {
  return (
    <div className="min-h-screen">
      <Suspense fallback={<PageLoadingState />}>
        <Routes>
          {/* Student Routes */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/result" element={<ResultPage />} />
          <Route path="/result/:legacyIdentifier" element={<Navigate to="/" replace />} />

          {/* Admin Auth Route */}
          <Route path="/admin/login" element={<AdminLoginPage />} />

          {/* Protected Admin Routes */}
          <Route element={<ProtectedRoute />}>
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<AdminDashboardPage />} />
              <Route path="students" element={<AdminStudentsPage />} />
              <Route path="subjects" element={<AdminSubjectsPage />} />
              <Route path="classrooms" element={<AdminClassroomsPage />} />
              <Route path="import" element={<AdminImportPage />} />
              <Route path="timetables" element={<AdminTimetablePage />} />
              <Route path="paths" element={<AdminPathsPage />} />
            </Route>
          </Route>

          {/* Legacy Admin Redirect */}
          <Route path="/admin/*" element={<Navigate to="/admin" replace />} />

          {/* 404 */}
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
    </div>
  )
}

export default App
