import { render, screen } from '@testing-library/react'
import type { Session } from '@supabase/supabase-js'
import { QueryClientProvider } from '@tanstack/react-query'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { routes } from '@/app/router'
import { AuthSessionContext } from '@/features/auth/AuthSessionContext'
import { createQueryClient } from '@/lib/queryClient'

function renderRoute(path: string, authenticated = false) {
  return render(
    <QueryClientProvider client={createQueryClient()}>
      <AuthSessionContext.Provider
        value={{ session: authenticated ? ({} as Session) : null, isLoading: false }}
      >
        <RouterProvider router={createMemoryRouter(routes, { initialEntries: [path] })} />
      </AuthSessionContext.Provider>
    </QueryClientProvider>,
  )
}

describe('application routes', () => {
  it('renders the home page', () => {
    renderRoute('/', true)
    expect(screen.getByRole('heading', { name: /find something worth looking forward to/i })).toBeVisible()
  })
  it('renders a helpful not-found page', () => {
    renderRoute('/missing', true)
    expect(screen.getByRole('heading', { name: /we could not find that page/i })).toBeVisible()
  })
  it('renders authentication outside the main app shell', () => {
    renderRoute('/auth')
    expect(screen.getByRole('heading', { name: /welcome back/i })).toBeVisible()
    expect(screen.queryByRole('navigation', { name: /primary navigation/i })).not.toBeInTheDocument()
  })
  it('redirects signed-out visitors away from protected pages', async () => {
    renderRoute('/family')
    expect(await screen.findByRole('heading', { name: /welcome back/i })).toBeVisible()
    expect(screen.queryByRole('navigation', { name: /primary navigation/i })).not.toBeInTheDocument()
  })
})
