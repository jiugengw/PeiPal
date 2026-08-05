import type { ReactNode } from 'react'

interface PageIntroProps { title: string; description: string; children?: ReactNode }

export function PageIntro({ title, description, children }: PageIntroProps) {
  return <section className="min-h-[620px] bg-[linear-gradient(105deg,var(--muted)_0%,var(--background)_100%)] px-5 py-14 sm:px-10 lg:px-16 lg:py-20"><div className="max-w-4xl"><h1 className="max-w-[12ch] text-5xl leading-[0.95] font-bold tracking-[-0.04em] text-foreground text-balance sm:text-6xl lg:text-8xl">{title}</h1><p className="mt-6 max-w-[65ch] text-lg leading-relaxed text-foreground sm:text-xl">{description}</p>{children ? <div className="mt-10">{children}</div> : null}</div></section>
}
