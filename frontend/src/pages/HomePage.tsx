import { Link } from 'react-router-dom'
import { PageIntro } from '@/shared/components/PageIntro'

export function HomePage() {
  return <PageIntro title="Find something worth looking forward to." description="Count Me In will help older adults discover nearby activities and ask trusted family or friends for one small, practical kind of support."><div className="flex flex-wrap gap-3"><Link className="inline-flex min-h-14 items-center rounded-md bg-primary px-6 font-bold text-primary-foreground hover:bg-foreground" to="/setup">Start setup</Link><Link className="inline-flex min-h-14 items-center rounded-md border border-input bg-background px-6 font-bold text-foreground hover:bg-muted" to="/family">Open family view</Link></div></PageIntro>
}
