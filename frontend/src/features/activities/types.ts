export interface Activity {
  databaseId: number
  dedupeKey: string
  title: string
  venue: string
  startsAt: Date | null
  endsAt: Date | null
  cost: number | null
  currency: string
  priceRemarks: string | null
  description: string
  tags: string[]
  mobilityNotes: string | null
  slotsAvailability: string | null
  infoLink: string | null
  signupLink: string | null
}
