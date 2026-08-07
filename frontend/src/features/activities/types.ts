export interface Activity {
  databaseId: number;
  dedupeKey: string;
  title: string;
  venue: string;
  startsAt: Date | null;
  endsAt: Date | null;
  cost: number | null;
  currency: string;
  description: string;
  tags: string[];
  infoLink: string | null;
  signupLink: string | null;
}
