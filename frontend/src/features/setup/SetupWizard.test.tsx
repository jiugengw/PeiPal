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
  beforeEach(() => {
    navigate.mockReset()
    mockedProgress.mockReset()
    mockedProgress.mockReturnValue(progress() as never)
  })

  afterEach(() => vi.restoreAllMocks())

  it('shows saved-setup loading and retries a failed load', async () => {
    const user = userEvent.setup()
    const refetch = vi.fn()
    mockedProgress.mockReturnValueOnce(progress({ isPending: true }) as never)
    const view = renderWizard()

    expect(screen.getByRole('status')).toHaveTextContent(/loading your saved setup/i)

    mockedProgress.mockReturnValue(progress({
      isError: true,
      householdsQuery: { refetch },
    }) as never)
    view.rerender(
      <QueryClientProvider client={createQueryClient()}>
        <SetupWizard />
      </QueryClientProvider>,
    )
    await user.click(screen.getByRole('button', { name: /try again/i }))

    expect(refetch).toHaveBeenCalledOnce()
  })

  it('does not submit an empty household name', async () => {
    const user = userEvent.setup()
    const post = vi.spyOn(fetchClient, 'POST')
    renderWizard()

    await user.click(screen.getByRole('button', { name: /create household/i }))

    expect(post).not.toHaveBeenCalled()
    expect(screen.getByLabelText(/household name/i)).toBeInvalid()
  })

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

  it('keeps the household draft after a failed save and succeeds on retry', async () => {
    const user = userEvent.setup()
    const post = vi.spyOn(fetchClient, 'POST')
      .mockResolvedValueOnce({
        error: { detail: 'Household service is unavailable.' },
        response: new Response(null, { status: 503 }),
      } as never)
      .mockResolvedValueOnce({
        data: { id: 1, name: 'Lim Family', created_by: 'user-1', created_at: '2030-01-01T00:00:00Z' },
        response: new Response(null, { status: 201 }),
      })
    renderWizard()

    const householdName = screen.getByLabelText(/household name/i)
    await user.type(householdName, 'Lim Family')
    await user.click(screen.getByRole('button', { name: /create household/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/household service is unavailable/i)
    expect(householdName).toHaveValue('Lim Family')

    await user.click(screen.getByRole('button', { name: /create household/i }))
    expect(await screen.findByRole('heading', { name: /what makes support comfortable/i })).toBeVisible()
    expect(post).toHaveBeenCalledTimes(2)
  })

  it('updates an existing household and profile through patch requests', async () => {
    const user = userEvent.setup()
    mockedProgress.mockReturnValue(progress({
      household: { id: 1, name: 'Lim Family' },
      olderAdult: { id: 2, household_id: 1, name: 'Mary Lim', sharing_mode: 'family_approval' },
    }) as never)
    const patchRequest = vi.spyOn(fetchClient, 'PATCH').mockResolvedValue({
      data: { id: 2, household_id: 1, name: 'Mary Lim', sharing_mode: 'direct', created_by: 'user-1', created_at: '2030-01-01T00:00:00Z' },
      response: new Response(null, { status: 200 }),
    })
    renderWizard()

    await user.click(screen.getByRole('button', { name: /back/i }))
    await user.click(screen.getByRole('button', { name: /back/i }))
    await user.click(screen.getByRole('button', { name: /back/i }))
    const householdName = screen.getByLabelText(/household name/i)
    await user.clear(householdName)
    await user.type(householdName, 'Lim Household')
    await user.click(screen.getByRole('button', { name: /save and continue/i }))

    expect(patchRequest).toHaveBeenCalledWith('/api/households/{household_id}', {
      params: { path: { household_id: 1 } },
      body: { name: 'Lim Household' },
    })

    await user.click(screen.getByRole('button', { name: /continue to sharing/i }))
    await user.click(screen.getByLabelText(/share after personal confirmation/i))
    await user.click(screen.getByRole('button', { name: /save profile/i }))

    expect(patchRequest).toHaveBeenCalledWith('/api/older-adults/{older_adult_id}', expect.objectContaining({
      params: { path: { older_adult_id: 2 } },
      body: expect.objectContaining({ name: 'Mary Lim', sharing_mode: 'direct' }),
    }))
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

  it('preserves profile fields and sharing choice while navigating back', async () => {
    const user = userEvent.setup()
    mockedProgress.mockReturnValue(progress({ household: { id: 1, name: 'Lim Family' } }) as never)
    renderWizard()

    await user.type(screen.getByLabelText(/full name/i), 'Mary Lim')
    await user.type(screen.getByLabelText(/preferred language/i), 'English')
    await user.click(screen.getByRole('button', { name: /continue to sharing/i }))
    await user.click(screen.getByLabelText(/share after personal confirmation/i))
    await user.click(screen.getByRole('button', { name: /back/i }))

    expect(screen.getByLabelText(/full name/i)).toHaveValue('Mary Lim')
    expect(screen.getByLabelText(/preferred language/i)).toHaveValue('English')

    await user.click(screen.getByRole('button', { name: /continue to sharing/i }))
    expect(screen.getByLabelText(/share after personal confirmation/i)).toBeChecked()
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

  it('creates and edits trusted contacts with the correct identifiers', async () => {
    const user = userEvent.setup()
    mockedProgress.mockReturnValue(progress({
      household: { id: 1, name: 'Lim Family' },
      olderAdult: { id: 2, household_id: 1, name: 'Mary Lim', sharing_mode: 'family_approval' },
      contacts: [{ id: 3, older_adult_id: 2, name: 'Anna', relationship: 'Daughter', email: 'anna@example.com', consent_status: 'pending', created_at: '2030-01-01T00:00:00Z' }],
    }) as never)
    const post = vi.spyOn(fetchClient, 'POST').mockResolvedValue({
      data: { id: 4, older_adult_id: 2, name: 'David', relationship: 'Son', phone: '+65 90000000', consent_status: 'pending', created_at: '2030-01-01T00:00:00Z' },
      response: new Response(null, { status: 201 }),
    })
    const patchRequest = vi.spyOn(fetchClient, 'PATCH').mockResolvedValue({
      data: { id: 3, older_adult_id: 2, name: 'Anna Lim', relationship: 'Daughter', email: 'anna@example.com', consent_status: 'pending', created_at: '2030-01-01T00:00:00Z' },
      response: new Response(null, { status: 200 }),
    })
    renderWizard()

    await user.type(screen.getByLabelText(/^name/i), 'David')
    await user.type(screen.getByLabelText(/relationship/i), 'Son')
    await user.type(screen.getByLabelText(/phone/i), '+65 90000000')
    await user.click(screen.getByRole('button', { name: /add contact/i }))

    expect(post).toHaveBeenCalledWith('/api/trusted-contacts', {
      body: expect.objectContaining({ older_adult_id: 2, name: 'David', relationship: 'Son', phone: '+65 90000000' }),
    })

    await user.click(screen.getByRole('button', { name: /edit/i }))
    const editName = screen.getByLabelText(/^name/i)
    await user.clear(editName)
    await user.type(editName, 'Anna Lim')
    await user.click(screen.getByRole('button', { name: /save contact/i }))

    expect(patchRequest).toHaveBeenCalledWith('/api/trusted-contacts/{contact_id}', {
      params: { path: { contact_id: 3 } },
      body: expect.objectContaining({ name: 'Anna Lim', relationship: 'Daughter' }),
    })
  })

  it('removes a trusted contact only after confirmation', async () => {
    const user = userEvent.setup()
    mockedProgress.mockReturnValue(progress({
      household: { id: 1, name: 'Lim Family' },
      olderAdult: { id: 2, household_id: 1, name: 'Mary Lim', sharing_mode: 'family_approval' },
      contacts: [{ id: 3, older_adult_id: 2, name: 'Anna', relationship: 'Daughter', email: 'anna@example.com', consent_status: 'pending', created_at: '2030-01-01T00:00:00Z' }],
    }) as never)
    const remove = vi.spyOn(fetchClient, 'DELETE').mockResolvedValue({
      data: undefined,
      response: new Response(null, { status: 204 }),
    } as never)
    const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true)
    renderWizard()

    await user.click(screen.getByRole('button', { name: /remove/i }))
    expect(remove).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: /remove/i }))

    expect(confirm).toHaveBeenCalledWith('Remove this trusted contact?')
    expect(remove).toHaveBeenCalledWith('/api/trusted-contacts/{contact_id}', {
      params: { path: { contact_id: 3 } },
    })
  })

  it('enforces the five-contact limit', () => {
    mockedProgress.mockReturnValue(progress({
      household: { id: 1, name: 'Lim Family' },
      olderAdult: { id: 2, household_id: 1, name: 'Mary Lim', sharing_mode: 'family_approval' },
      contacts: Array.from({ length: 5 }, (_, index) => ({
        id: index + 1,
        older_adult_id: 2,
        name: `Contact ${index + 1}`,
        relationship: 'Family',
        email: `contact${index + 1}@example.com`,
        consent_status: 'pending',
        created_at: '2030-01-01T00:00:00Z',
      })),
      isComplete: true,
    }) as never)
    renderWizard()

    expect(screen.getByText(/five people, which is the limit/i)).toBeVisible()
    expect(screen.queryByRole('button', { name: /add contact/i })).not.toBeInTheDocument()
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
