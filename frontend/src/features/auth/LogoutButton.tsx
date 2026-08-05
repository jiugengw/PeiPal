import { useMutation } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { signOut } from '@/features/auth/signOut'

export function LogoutButton() {
  const navigate = useNavigate()
  const mutation = useMutation({
    mutationFn: signOut,
    onSuccess: () => { void navigate('/auth', { replace: true }) },
  })

  return (
    <div className="flex items-center gap-2">
      <button className="inline-flex min-h-12 cursor-pointer items-center rounded-xl border-0 bg-transparent px-[15px] font-bold text-foreground hover:bg-muted disabled:cursor-wait disabled:opacity-60" type="button" disabled={mutation.isPending} onClick={() => mutation.mutate()}>{mutation.isPending ? 'Logging out…' : 'Log out'}</button>
      {mutation.isError ? <span className="max-w-40 text-sm font-bold text-foreground" role="alert">Could not log out. Try again.</span> : null}
    </div>
  )
}
