import { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AuthForm } from "@/features/auth/AuthForm";
import { useAuthSession } from "@/features/auth/AuthSessionContext";

export function AuthPage() {
  const navigate = useNavigate();
  const { session } = useAuthSession();

  useEffect(() => {
    if (session) void navigate("/setup", { replace: true });
  }, [navigate, session]);

  return (
    <div className="flex h-dvh w-full flex-col overflow-hidden bg-background text-foreground">
      <a
        className="fixed -top-20 left-5 z-20 rounded-xl bg-background px-4 py-3 text-foreground focus:top-4"
        href="#auth-content"
      >
        Skip to account form
      </a>
      <header className="flex h-16 flex-none items-center justify-between gap-4 border-b border-border bg-background px-4 sm:px-8 lg:px-12">
        <Link
          className="inline-flex min-h-11 items-center gap-2.5 text-base font-extrabold text-foreground no-underline sm:text-[1.1rem]"
          to="/"
          aria-label="Count Me In home"
        >
          <span
            className="grid size-10 place-items-center rounded-xl bg-primary text-sm text-primary-foreground"
            aria-hidden="true"
          >
            CM
          </span>
          <span className="max-[380px]:sr-only">Count Me In</span>
        </Link>
        <Link
          className="inline-flex min-h-11 items-center rounded-[10px] px-3 font-extrabold text-foreground underline underline-offset-4 hover:bg-muted"
          to="/"
        >
          Back to home
        </Link>
      </header>
      <main
        className="grid min-h-0 flex-1 overflow-hidden lg:grid-cols-[minmax(320px,0.8fr)_minmax(420px,1.2fr)]"
        id="auth-content"
      >
        <section
          className="hidden min-w-0 flex-col justify-between gap-8 bg-[linear-gradient(105deg,var(--accent)_0%,var(--muted)_100%)] px-[clamp(32px,5vw,72px)] py-[clamp(32px,6vh,64px)] lg:flex"
          aria-labelledby="auth-reassurance-title"
        >
          <div>
            <h2
              className="m-0 max-w-[13ch] text-[clamp(2.4rem,4vw,4rem)] leading-[0.98] font-bold tracking-[-0.035em] text-balance"
              id="auth-reassurance-title"
            >
              A comfortable way to plan with people you trust.
            </h2>
            <p className="mt-4 max-w-[38ch] text-base leading-relaxed">
              Keep activity ideas together, ask for practical support, and stay
              in control of what gets shared.
            </p>
          </div>
          <p className="mt-auto max-w-[38ch] border-t border-input pt-4 text-base leading-relaxed font-extrabold">
            Your plans stay private until you choose to share them.
          </p>
        </section>
        <div className="grid min-h-0 place-items-center px-4 py-4 sm:px-8 lg:px-12">
          <div className="w-full max-w-[420px]"><AuthForm /></div>
        </div>
      </main>
    </div>
  );
}
