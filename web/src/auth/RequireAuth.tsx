import { Navigate, Outlet, useLocation } from 'react-router-dom'

import { FullPageLoader } from '../components/common/FullPageLoader'
import { useNhost } from '../nhost/useNhost'

export function RequireAuth() {
  const { isAuthenticated, isLoading } = useNhost()
  const location = useLocation()

  if (isLoading) return <FullPageLoader />

  if (!isAuthenticated) {
    return <Navigate to="/auth/login" replace state={{ from: location.pathname }} />
  }

  return <Outlet />
}





