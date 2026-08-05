import type { Session } from '@supabase/supabase-js'
import { QueryClientProvider } from '@tanstack/react-query'
import {
  RouterProvider,
  createMemoryHistory,
  createRouter,
} from '@tanstack/react-router'
import { render, screen } from '@testing-library/react'
import { routeTree } from '@/routeTree.gen'
import { AuthSessionContext } from '@/features/auth/AuthSessionContext'
import { createQueryClient } from '@/lib/queryClient'

function renderRoute(path: string, authenticated = false) {
  const auth = {
    session: authenticated ? ({} as Session) : null,
    isLoading: false,
  }
  const testRouter = createRouter({
    routeTree,
    context: { auth },
    history: createMemoryHistory({ initialEntries: [path] }),
  })

  return render(
    <QueryClientProvider client={createQueryClient()}>
      <AuthSessionContext.Provider value={auth}>
        <RouterProvider router={testRouter} context={{ auth }} />
      </AuthSessionContext.Provider>
    </QueryClientProvider>,
  )
}

describe('application routes', () => {
  it('renders the home page for an authenticated user', async () => {
    renderRoute('/', true)
    expect(
      await screen.findByRole('heading', {
        name: /find something worth looking forward to/i,
      }),
    ).toBeVisible()
  })

  it('renders a helpful not-found page for an authenticated user', async () => {
    renderRoute('/missing', true)
    expect(
      await screen.findByRole('heading', {
        name: /we could not find that page/i,
      }),
    ).toBeVisible()
  })

  it('renders authentication outside the main app shell', async () => {
    renderRoute('/auth')
    expect(
      await screen.findByRole('heading', { name: /welcome back/i }),
    ).toBeVisible()
    expect(
      screen.queryByRole('navigation', { name: /primary navigation/i }),
    ).not.toBeInTheDocument()
  })

  it('redirects signed-out visitors away from protected pages', async () => {
    renderRoute('/family')
    expect(
      await screen.findByRole('heading', { name: /welcome back/i }),
    ).toBeVisible()
    expect(
      screen.queryByRole('navigation', { name: /primary navigation/i }),
    ).not.toBeInTheDocument()
  })
})
