import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ActivitySearchForm } from '@/features/activities/ActivitySearchForm'

describe('ActivitySearchForm', () => {
  it('reports each keystroke immediately, with no submit step', async () => {
    const user = userEvent.setup()
    const onSearch = vi.fn()
    render(<ActivitySearchForm onSearch={onSearch} query="" />)

    await user.type(screen.getByLabelText(/search by activity, neighborhood, or venue/i), 'gen')

    expect(onSearch).toHaveBeenLastCalledWith('gen')
    expect(screen.queryByRole('button', { name: /search/i })).not.toBeInTheDocument()
  })

  it('only shows the clear action once there is a query', async () => {
    const user = userEvent.setup()
    const { rerender } = render(<ActivitySearchForm onSearch={vi.fn()} query="" />)

    expect(screen.queryByRole('button', { name: /clear/i })).not.toBeInTheDocument()

    rerender(<ActivitySearchForm onSearch={vi.fn()} query="gen" />)
    expect(screen.getByRole('button', { name: /clear/i })).toBeVisible()

    const onSearch = vi.fn()
    rerender(<ActivitySearchForm onSearch={onSearch} query="gen" />)
    await user.click(screen.getByRole('button', { name: /clear/i }))
    expect(onSearch).toHaveBeenCalledWith('')
  })

  it('reflects an externally cleared query, such as from the empty state', () => {
    const { rerender } = render(<ActivitySearchForm onSearch={vi.fn()} query="gen" />)
    expect(screen.getByLabelText(/search by activity/i)).toHaveValue('gen')

    rerender(<ActivitySearchForm onSearch={vi.fn()} query="" />)
    expect(screen.getByLabelText(/search by activity/i)).toHaveValue('')
  })
})
