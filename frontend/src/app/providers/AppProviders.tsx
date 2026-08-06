import { QueryClientProvider } from '@tanstack/react-query'
import { useState, type ReactNode } from 'react'
import { AuthSessionProvider } from '@/features/auth/AuthSessionProvider'
import { createQueryClient } from '@/lib/queryClient'

interface AppProvidersProps {
  children: ReactNode
}

export function AppProviders({ children }: AppProvidersProps) {
  const [queryClient] = useState(createQueryClient)
  return <QueryClientProvider client={queryClient}><AuthSessionProvider>{children}</AuthSessionProvider></QueryClientProvider>
}
