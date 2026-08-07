import { QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SetupWizard } from '@/features/setup/SetupWizard'
import { useSetupProgress } from '@/features/setup/useSetupProgress'
import { fetchClient } from '@/lib/fetchClient'
import { createQueryClient } from '@/lib/queryClient'

const { navigate } = vi.hoisted(() => ({ navigate: vi.fn() }))

vi.mock('@tanstack/react-router', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@tanstack/react-router')>()),
  useNavigate: () => navigate,
}))

vi.mock('@/features/setup/useSetupProgress', () => ({
  useSetupProgress: vi.fn(),
}))

const mockedProgress = vi.mocked(useSetupProgress)

function progress(overrides: Record<string, unknown> = {}) {
  return {
    household: undefined,
    olderAdult: undefined,
    contacts: [],
    isPending: false,
    isError: false,
    isComplete: false,
    householdsQuery: { refetch: vi.fn() },
    olderAdultsQuery: { refetch: vi.fn() },
    trustedContactsQuery: { refetch: vi.fn() },
    ...overrides,
  }
}

function renderWizard() {
  return render(
    <QueryClientProvider client={createQueryClient()}>
      <SetupWizard />
    </QueryClientProvider>,
  )
}

describe('SetupWizard', () => {
  beforeEach(() => mockedProgress.mockReturnValue(progress() as never))

  it('creates a household and advances to profile details', async () => {
    const user = userEvent.setup()
    vi.spyOn(fetchClient, 'POST').mockResolvedValueOnce({
      data: { id: 1, name: 'Lim Family', created_by: 'user-1', created_at: '2030-01-01T00:00:00Z' },
      response: new Response(null, { status: 201 }),
    })
    renderWizard()

    await user.type(screen.getByLabelText(/household name/i), 'Lim Family')
    await user.click(screen.getByRole('button', { name: /create household/i }))

    expect(fetchClient.POST).toHaveBeenCalledWith('/api/households', {
      body: { name: 'Lim Family' },
    })
    expect(await screen.findByRole('heading', { name: /what makes support comfortable/i })).toBeVisible()
  })

  it('resumes at profile details and submits the selected sharing mode', async () => {
    const user = userEvent.setup()
    mockedProgress.mockReturnValue(progress({ household: { id: 1, name: 'Lim Family' } }) as never)
    vi.spyOn(fetchClient, 'POST').mockResolvedValueOnce({
      data: { id: 2, household_id: 1, name: 'Mary Lim', sharing_mode: 'direct', created_by: 'user-1', created_at: '2030-01-01T00:00:00Z' },
      response: new Response(null, { status: 201 }),
    })
    renderWizard()

    await user.type(screen.getByLabelText(/full name/i), 'Mary Lim')
    await user.click(screen.getByRole('button', { name: /continue to sharing/i }))
    await user.click(screen.getByLabelText(/share after personal confirmation/i))
    await user.click(screen.getByRole('button', { name: /save profile/i }))

    expect(fetchClient.POST).toHaveBeenCalledWith('/api/older-adults', expect.objectContaining({
      body: expect.objectContaining({ household_id: 1, name: 'Mary Lim', sharing_mode: 'direct' }),
    }))
  })

  it('requires a contact method before saving a trusted contact', async () => {
    const user = userEvent.setup()
    mockedProgress.mockReturnValue(progress({
      household: { id: 1, name: 'Lim Family' },
      olderAdult: { id: 2, household_id: 1, name: 'Mary Lim', sharing_mode: 'family_approval' },
    }) as never)
    renderWizard()

    await user.type(screen.getByLabelText(/^name/i), 'Anna Lim')
    await user.type(screen.getByLabelText(/relationship/i), 'Daughter')
    await user.click(screen.getByRole('button', { name: /add contact/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/email address or phone number/i)
  })

  it('allows a completed setup to continue to discovery', async () => {
    const user = userEvent.setup()
    mockedProgress.mockReturnValue(progress({
      household: { id: 1, name: 'Lim Family' },
      olderAdult: { id: 2, household_id: 1, name: 'Mary Lim', sharing_mode: 'family_approval' },
      contacts: [{ id: 3, older_adult_id: 2, name: 'Anna', relationship: 'Daughter', email: 'anna@example.com', consent_status: 'pending', created_at: '2030-01-01T00:00:00Z' }],
      isComplete: true,
    }) as never)
    renderWizard()

    await user.click(screen.getByRole('button', { name: /finish setup/i }))
    expect(navigate).toHaveBeenCalledWith({ to: '/discover' })
  })
})
