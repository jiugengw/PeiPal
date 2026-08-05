import type { Session } from '@supabase/supabase-js'
import { useEffect, useState, type ReactNode } from 'react'
import { AuthSessionContext } from '@/features/auth/AuthSessionContext'
import { getSupabaseClient } from '@/lib/supabase'
import { environment } from '@/services/environment'

export function AuthSessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [isLoading, setIsLoading] = useState(Boolean(environment.supabase))

  useEffect(() => {
    if (!environment.supabase) return

    let isActive = true
    let unsubscribe: (() => void) | undefined
    void getSupabaseClient()
      .then((supabase) => {
        if (!isActive) return
        const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
          if (!isActive) return
          setSession(nextSession)
          setIsLoading(false)
        })
        unsubscribe = () => data.subscription.unsubscribe()
      })
      .catch(() => {
        if (isActive) setIsLoading(false)
      })

    return () => {
      isActive = false
      unsubscribe?.()
    }
  }, [])

  return <AuthSessionContext.Provider value={{ session, isLoading }}>{children}</AuthSessionContext.Provider>
}
