import { createFileRoute } from '@tanstack/react-router'
import { PageIntro } from '@/components/PageIntro'

export const Route = createFileRoute('/_authenticated/setup')({
  component: SetupPage,
})

function SetupPage() {
  return (
    <PageIntro
      title="Set up support without taking over."
      description="This route will hold the family-assisted profile, mobility, transport, language, and trusted-circle setup flow."
    >
      <p className="max-w-[65ch] rounded-lg bg-background p-6 text-lg text-foreground shadow-[0_16px_40px_rgb(37_44_64_/_0.10)]">
        Foundation ready. The full setup experience will be migrated in the next
        frontend phase.
      </p>
    </PageIntro>
  )
}
