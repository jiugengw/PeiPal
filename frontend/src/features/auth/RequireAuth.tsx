import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuthSession } from '@/features/auth/AuthSessionContext'

export function RequireAuth() {
  const { session, isLoading } = useAuthSession()
  const location = useLocation()

  if (isLoading) {
    return (
      <main className="grid h-dvh place-items-center bg-background px-6 text-center text-foreground">
        <p className="text-lg font-bold" role="status">
          Checking your account…
        </p>
      </main>
    )
  }

  if (!session) {
    const returnTo = `${location.pathname}${location.search}${location.hash}`
    return <Navigate to="/auth" replace state={{ returnTo }} />
  }

  return <Outlet />
}
