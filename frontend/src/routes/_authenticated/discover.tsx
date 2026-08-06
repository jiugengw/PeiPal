import { createFileRoute } from '@tanstack/react-router'
import { ActivityDiscovery } from '@/features/activities/ActivityDiscovery'

export const Route = createFileRoute('/_authenticated/discover')({
  component: DiscoverPage,
})

function DiscoverPage() {
  return <ActivityDiscovery />
}
