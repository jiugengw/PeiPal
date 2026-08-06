import { QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ActivityDiscovery } from '@/features/activities/ActivityDiscovery'
import { useSetupProgress } from '@/features/setup/useSetupProgress'
import { fetchClient } from '@/lib/fetchClient'
import { createQueryClient } from '@/lib/queryClient'

vi.mock('@/features/setup/useSetupProgress', () => ({
  useSetupProgress: vi.fn(),
}))

const mockedProgress = vi.mocked(useSetupProgress)

function activityResponse(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    dedupe_key: 'senior-yoga-bishan',
    name: 'Senior Yoga',
    location: 'Bishan Community Club',
    start_at: '2030-06-01T09:00:00Z',
    currency: 'SGD',
    info_link: 'https://example.com/senior-yoga',
    cost: 0,
    tags: ['gentle'],
    status: 'active',
    first_seen_at: '2029-12-01T00:00:00Z',
    last_seen_at: '2029-12-15T00:00:00Z',
    last_checked_at: '2029-12-15T00:00:00Z',
    ...overrides,
  }
}

function renderPage() {
  return render(
    <QueryClientProvider client={createQueryClient()}>
      <ActivityDiscovery />
    </QueryClientProvider>,
  )
}

describe('ActivityDiscovery', () => {
  beforeEach(() => {
    mockedProgress.mockReturnValue({ olderAdult: { preferred_name: 'Mary' } } as never)
  })

  it('greets the older adult by preferred name and lists activities', async () => {
    vi.spyOn(fetchClient, 'GET').mockResolvedValueOnce({
      data: { activities: [activityResponse()] },
      response: new Response(null, { status: 200 }),
    } as never)

    renderPage()

    expect(await screen.findByRole('heading', { name: /something new for mary/i })).toBeVisible()
    expect(await screen.findByText('Senior Yoga')).toBeVisible()
  })

  it('selecting an activity shows it in the detail panel and disables re-choosing it', async () => {
    const user = userEvent.setup()
    vi.spyOn(fetchClient, 'GET').mockResolvedValueOnce({
      data: { activities: [activityResponse()] },
      response: new Response(null, { status: 200 }),
    } as never)

    renderPage()

    await user.click(await screen.findByRole('button', { name: /choose this activity/i }))

    const panel = screen.getByRole('heading', { name: 'Senior Yoga', level: 2 }).closest('div')
    expect(panel).not.toBeNull()
    expect(within(panel as HTMLElement).getByText(/bishan community club/i)).toBeVisible()
    expect(screen.getByRole('button', { name: /^selected$/i })).toBeDisabled()
  })

  it('clears the selection and explains it when the activity disappears from a refreshed result set', async () => {
    const user = userEvent.setup()
    vi.spyOn(fetchClient, 'GET')
      .mockResolvedValueOnce({
        data: { activities: [activityResponse()] },
        response: new Response(null, { status: 200 }),
      } as never)
      .mockResolvedValueOnce({
        data: { activities: [] },
        response: new Response(null, { status: 200 }),
      } as never)

    renderPage()
    await user.click(await screen.findByRole('button', { name: /choose this activity/i }))
    expect(screen.getByRole('button', { name: /^selected$/i })).toBeInTheDocument()

    await user.type(screen.getByLabelText(/search by neighborhood or venue/i), 'Toa Payoh')
    await user.click(screen.getByRole('button', { name: /^search$/i }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/no longer available/i)
    })
    expect(screen.getByText('No activity chosen yet')).toBeVisible()
  })

  it('searching by location requests the filtered results and offers a clear action once empty', async () => {
    const user = userEvent.setup()
    vi.spyOn(fetchClient, 'GET').mockResolvedValue({
      data: { activities: [] },
      response: new Response(null, { status: 200 }),
    } as never)

    renderPage()
    await user.type(screen.getByLabelText(/search by neighborhood or venue/i), 'Punggol')
    await user.click(screen.getByRole('button', { name: /^search$/i }))

    expect(await screen.findByText(/no activities found near "punggol"/i)).toBeVisible()
    await user.click(screen.getByRole('button', { name: /clear location filter/i }))

    expect(screen.getByLabelText(/search by neighborhood or venue/i)).toHaveValue('')
  })
})
