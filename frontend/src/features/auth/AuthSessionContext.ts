import type { Session } from '@supabase/supabase-js'
import { createContext, useContext } from 'react'

export interface AuthSessionContextValue {
  session: Session | null
  isLoading: boolean
}

export const AuthSessionContext = createContext<AuthSessionContextValue | undefined>(undefined)

export function useAuthSession() {
  const value = useContext(AuthSessionContext)
  if (!value) throw new Error('useAuthSession must be used within AuthSessionProvider.')
  return value
}
