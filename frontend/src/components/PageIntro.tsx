import type { ReactNode } from "react";

interface PageIntroProps {
  title: string;
  description: string;
  children?: ReactNode;
}

export function PageIntro({ title, description, children }: PageIntroProps) {
  return (
    <section className="flex h-full w-full items-center bg-[linear-gradient(105deg,var(--muted)_0%,var(--background)_100%)] px-5 py-8 sm:px-10 lg:px-16">
      <div className="mx-auto w-full max-w-[1200px]">
        <h1 className="max-w-[12ch] text-5xl leading-[0.95] font-bold tracking-[-0.04em] text-foreground text-balance sm:text-6xl lg:text-7xl">
          {title}
        </h1>
        <p className="mt-5 max-w-[65ch] text-lg leading-relaxed text-foreground sm:text-xl">
          {description}
        </p>
        {children ? <div className="mt-8">{children}</div> : null}
      </div>
    </section>
  );
}
