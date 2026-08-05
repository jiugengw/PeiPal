import { render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { routes } from '@/app/router'

describe('application routes', () => {
  it('renders the home page', () => {
    render(<RouterProvider router={createMemoryRouter(routes, { initialEntries: ['/'] })} />)
    expect(screen.getByRole('heading', { name: /find something worth looking forward to/i })).toBeVisible()
  })
  it('renders a helpful not-found page', () => {
    render(<RouterProvider router={createMemoryRouter(routes, { initialEntries: ['/missing'] })} />)
    expect(screen.getByRole('heading', { name: /we could not find that page/i })).toBeVisible()
  })
})
