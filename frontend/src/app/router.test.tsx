import { render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { AppProviders } from '@/app/providers/AppProviders'
import { routes } from '@/app/router'

function renderRoute(path: string) {
  return render(<AppProviders><RouterProvider router={createMemoryRouter(routes, { initialEntries: [path] })} /></AppProviders>)
}

describe('application routes', () => {
  it('renders the home page', () => {
    renderRoute('/')
    expect(screen.getByRole('heading', { name: /find something worth looking forward to/i })).toBeVisible()
  })
  it('renders a helpful not-found page', () => {
    renderRoute('/missing')
    expect(screen.getByRole('heading', { name: /we could not find that page/i })).toBeVisible()
  })
  it('renders authentication outside the main app shell', () => {
    renderRoute('/auth')
    expect(screen.getByRole('heading', { name: /welcome back/i })).toBeVisible()
    expect(screen.queryByRole('navigation', { name: /primary navigation/i })).not.toBeInTheDocument()
  })
})
