import { useQueryClient } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { AppProviders } from '@/app/providers/AppProviders'
import { createQueryClient } from '@/lib/queryClient'

function QueryClientProbe() {
  const queryClient = useQueryClient()
  return <span>{queryClient ? 'Query client ready' : 'Query client missing'}</span>
}

describe('AppProviders', () => {
  it('makes the query client available to the application', () => {
    render(<AppProviders><QueryClientProbe /></AppProviders>)
    expect(screen.getByText('Query client ready')).toBeVisible()
  })

  it('uses stable application query defaults', () => {
    expect(createQueryClient().getDefaultOptions().queries).toMatchObject({
      staleTime: 60_000,
      retry: 1,
      refetchOnWindowFocus: false,
    })
  })
})
