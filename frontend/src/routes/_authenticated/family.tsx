import { createFileRoute } from '@tanstack/react-router'
import { FamilyPage } from '@/pages/FamilyPage'

export const Route = createFileRoute('/_authenticated/family')({
  component: FamilyPage,
})
