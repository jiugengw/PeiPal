import type { PlanStatus } from '@/features/plans/api/planQueries'

export const planStatusLabels: Record<PlanStatus, string> = {
  draft: 'Draft',
  awaiting_approval: 'Waiting for family approval',
  shared: 'Shared with your trusted circle',
  cancelled: 'Cancelled',
}
