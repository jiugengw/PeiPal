import { createFileRoute, redirect } from '@tanstack/react-router'
import { AuthPage } from '@/pages/AuthPage'

export const Route = createFileRoute('/auth')({
  validateSearch: (search: Record<string, unknown>) => ({
    redirect: typeof search.redirect === 'string' ? search.redirect : undefined,
  }),
  beforeLoad: ({ context, search }) => {
    if (!context.auth.session) return

    const destination =
      search.redirect?.startsWith('/') && !search.redirect.startsWith('/auth')
        ? search.redirect
        : '/setup'

    throw redirect({ href: destination, replace: true })
  },
  component: AuthPage,
})
