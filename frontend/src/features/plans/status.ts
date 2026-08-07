import type { PlanStatus } from '@/features/plans/api/planQueries'

export const planStatusLabels: Record<PlanStatus, string> = {
  draft: 'Draft',
  awaiting_approval: 'Waiting for a family decision',
  approved: 'Approved by your family',
  rejected: 'Not approved by your family',
  shared: 'Shared with your family',
  cancelled: 'Cancelled',
}
