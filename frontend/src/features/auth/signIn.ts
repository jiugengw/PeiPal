import { getSupabaseClient } from '@/lib/supabase'

export interface SignInInput {
  email: string
  password: string
}

export async function signIn({ email, password }: SignInInput): Promise<void> {
  const supabase = await getSupabaseClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
}
