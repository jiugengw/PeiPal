import { signIn } from '@/features/auth/signIn'
import { getSupabaseClient } from '@/lib/supabase'

vi.mock('@/lib/supabase', () => ({ getSupabaseClient: vi.fn() }))

describe('signIn', () => {
  it('signs in with an email and password', async () => {
    const signInWithPassword = vi.fn().mockResolvedValue({ error: null })
    vi.mocked(getSupabaseClient).mockResolvedValue({ auth: { signInWithPassword } } as never)
    await signIn({ email: 'mary@example.com', password: 'safe-passphrase' })
    expect(signInWithPassword).toHaveBeenCalledWith({ email: 'mary@example.com', password: 'safe-passphrase' })
  })

  it('passes authentication errors to the caller', async () => {
    const authError = new Error('Invalid login credentials')
    const signInWithPassword = vi.fn().mockResolvedValue({ error: authError })
    vi.mocked(getSupabaseClient).mockResolvedValue({ auth: { signInWithPassword } } as never)
    await expect(signIn({ email: 'mary@example.com', password: 'wrong-password' })).rejects.toBe(authError)
  })
})
