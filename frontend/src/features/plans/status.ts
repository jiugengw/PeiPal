import type { PlanStatus } from '@/features/plans/api/planQueries'

export const planStatusLabels: Record<PlanStatus, string> = {
  draft: 'Not asked yet',
  coordinating: 'Waiting for your family',
  ready: 'All arranged',
  completed: 'Done',
  rejected: 'Your family said no this time',
  cancelled: 'Cancelled',
}
