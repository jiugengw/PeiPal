import { createFileRoute } from '@tanstack/react-router'
import { PageIntro } from '@/components/PageIntro'

export const Route = createFileRoute('/_authenticated/family')({
  component: FamilyPage,
})

function FamilyPage() {
  return (
    <PageIntro
      title="One plan. One small way to help."
      description="This route will show approved plans and let trusted people offer transport, a reminder, help booking, or company."
    >
      <p className="max-w-[65ch] rounded-lg border border-border bg-background p-6 text-lg text-foreground">
        No plan is waiting yet. Nothing is shared until the older adult chooses.
      </p>
    </PageIntro>
  )
}
