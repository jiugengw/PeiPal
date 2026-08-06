import { getSupabaseClient } from '@/lib/supabase'

export interface SignUpInput {
  fullName: string
  email: string
  password: string
}

export interface SignUpResult {
  confirmationRequired: boolean
}

export async function signUp({ fullName, email, password }: SignUpInput): Promise<SignUpResult> {
  const supabase = await getSupabaseClient()
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName },
      emailRedirectTo: `${window.location.origin}/auth`,
    },
  })

  if (error) throw error
  return { confirmationRequired: data.session === null }
}
