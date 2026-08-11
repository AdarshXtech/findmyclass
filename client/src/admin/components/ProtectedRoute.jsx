import { useEffect, useState } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import adminApi from '../api'
import { getAdminUser, setAdminSession } from '../auth'
import PageLoadingState from '../../components/PageLoadingState'

export default function ProtectedRoute() {
  const location = useLocation()
  const [authenticated, setAuthenticated] = useState(() => Boolean(getAdminUser()))
  const [checking, setChecking] = useState(() => !getAdminUser())

  useEffect(() => {
    if (!checking) return
    adminApi.get('/session')
      .then((response) => {
        setAdminSession(response.data.data.admin, response.data.data.csrfToken)
        setAuthenticated(true)
      })
      .catch(() => setAuthenticated(false))
      .finally(() => setChecking(false))
  }, [checking])

  if (checking) return <PageLoadingState />

  if (!authenticated) {
    return <Navigate to="/admin/login" replace state={{ from: location.pathname }} />
  }

  return <Outlet />
}
