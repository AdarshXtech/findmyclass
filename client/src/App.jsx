import { Navigate, Routes, Route } from 'react-router-dom'
import LandingPage from './pages/LandingPage'
import ResultPage from './pages/ResultPage'
import NotFoundPage from './pages/NotFoundPage'
import AdminLoginPage from './pages/AdminLoginPage'
import AdminDashboardPage from './pages/AdminDashboardPage'
import AdminPlaceholderPage from './pages/AdminPlaceholderPage'
import AdminStudentsPage from './pages/AdminStudentsPage'
import AdminSubjectsPage from './pages/AdminSubjectsPage'
import AdminClassroomsPage from './pages/AdminClassroomsPage'
import AdminImportPage from './pages/AdminImportPage'
import ProtectedRoute from './admin/components/ProtectedRoute'
import AdminLayout from './admin/components/AdminLayout'

function App() {
  return (
    <div className="min-h-screen">
      <Routes>
        {/* Student Routes */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/result/:phone" element={<ResultPage />} />

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
            <Route
              path="settings"
              element={<AdminPlaceholderPage title="Settings" description="This module will be expanded in Part 7." />}
            />
          </Route>
        </Route>

        {/* Legacy Admin Redirect */}
        <Route path="/admin/*" element={<Navigate to="/admin" replace />} />

        {/* 404 */}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </div>
  )
}

export default App
