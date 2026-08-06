import { createFileRoute, Link } from '@tanstack/react-router'
import { PageIntro } from '@/components/PageIntro'

export const Route = createFileRoute('/_authenticated/discover')({
  component: DiscoverPage,
})

function DiscoverPage() {
  return (
    <PageIntro
      title="Your trusted circle is ready."
      description="Activity discovery is the next step. Your household, preferences, and trusted contacts are safely set up."
    >
      <Link
        className="inline-flex min-h-14 items-center rounded-xl border border-input bg-background px-6 font-extrabold text-foreground no-underline hover:bg-muted"
        to="/setup"
      >
        Review setup
      </Link>
    </PageIntro>
  )
}
