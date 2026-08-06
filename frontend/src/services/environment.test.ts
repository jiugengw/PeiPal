import { readEnvironment, type EnvironmentInput } from '@/services/environment'

describe('readEnvironment', () => {
  it('normalizes the API URL', () => { expect(readEnvironment({ VITE_API_BASE_URL: 'http://localhost:8000/' }).apiBaseUrl).toBe('http://localhost:8000') })
  it('accepts complete Supabase settings', () => {
    const input: EnvironmentInput = { VITE_SUPABASE_URL: 'https://example.supabase.co', VITE_SUPABASE_ANON_KEY: 'public-key' }
    expect(readEnvironment(input).supabase?.anonKey).toBe('public-key')
  })
  it('rejects partial Supabase settings', () => { expect(() => readEnvironment({ VITE_SUPABASE_URL: 'https://example.supabase.co' })).toThrow(/provided together/i) })
})
