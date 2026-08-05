import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AuthForm } from '@/features/auth/AuthForm'

describe('AuthForm', () => {
  it('switches between login and account creation', async () => {
    const user = userEvent.setup()
    render(<AuthForm />)
    expect(screen.queryByLabelText(/full name/i)).not.toBeInTheDocument()
    await user.click(screen.getByRole('tab', { name: /create account/i }))
    expect(screen.getByLabelText(/full name/i)).toBeVisible()
    expect(screen.getByRole('button', { name: /create account/i })).toBeVisible()
  })

  it('shows useful validation and focuses the first invalid field', async () => {
    const user = userEvent.setup()
    render(<AuthForm />)
    await user.click(screen.getByRole('button', { name: /^log in$/i }))
    expect(screen.getByLabelText(/email address/i)).toHaveFocus()
    expect(screen.getByText(/enter your email address/i)).toBeVisible()
    expect(screen.getByText(/enter your password/i)).toBeVisible()
  })

  it('reveals and hides the password', async () => {
    const user = userEvent.setup()
    render(<AuthForm />)
    const password = screen.getByLabelText(/^password$/i)
    expect(password).toHaveAttribute('type', 'password')
    await user.click(screen.getByRole('button', { name: /show password/i }))
    expect(password).toHaveAttribute('type', 'text')
    await user.click(screen.getByRole('button', { name: /hide password/i }))
    expect(password).toHaveAttribute('type', 'password')
  })

  it('reports mock success without claiming a login occurred', async () => {
    const user = userEvent.setup()
    render(<AuthForm />)
    await user.type(screen.getByLabelText(/email address/i), 'person@example.com')
    await user.type(screen.getByLabelText(/^password$/i), 'safe-passphrase')
    await user.click(screen.getByRole('button', { name: /^log in$/i }))
    expect(screen.getByRole('status')).toHaveTextContent(/no login occurred/i)
  })

  it('clears entered values and status when the mode changes', async () => {
    const user = userEvent.setup()
    render(<AuthForm />)
    await user.type(screen.getByLabelText(/email address/i), 'person@example.com')
    await user.type(screen.getByLabelText(/^password$/i), 'safe-passphrase')
    await user.click(screen.getByRole('button', { name: /^log in$/i }))
    await user.click(screen.getByRole('tab', { name: /create account/i }))
    expect(screen.getByLabelText(/email address/i)).toHaveValue('')
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })
})
