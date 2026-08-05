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
    <div className="mx-auto flex h-dvh w-full flex-col overflow-hidden bg-background text-foreground sm:my-4 sm:h-[calc(100dvh-2rem)] sm:w-[min(1040px,calc(100%-2rem))] sm:rounded-2xl sm:border sm:border-border sm:shadow-[0_20px_60px_rgb(37_44_64_/_0.10)]">
      <a
        className="fixed -top-20 left-5 z-20 rounded-xl bg-background px-4 py-3 text-foreground focus:top-4"
        href="#auth-content"
      >
        Skip to account form
      </a>
      <header className="flex min-h-[72px] flex-none items-center justify-between gap-5 border-b border-border px-5 py-2.5 sm:px-9 max-[480px]:items-start max-[480px]:flex-col max-[480px]:gap-2">
        <Link
          className="inline-flex items-center gap-3 text-[1.1rem] font-extrabold text-foreground no-underline"
          to="/"
          aria-label="Count Me In home"
        >
          <span
            className="grid size-11 place-items-center rounded-xl bg-primary text-primary-foreground"
            aria-hidden="true"
          >
            CM
          </span>
          <span>Count Me In</span>
        </Link>
        <Link
          className="inline-flex min-h-12 items-center rounded-[10px] px-3.5 font-extrabold text-foreground underline underline-offset-4 hover:bg-muted max-[480px]:ml-[58px]"
          to="/"
        >
          Back to home
        </Link>
      </header>
      <main
        className="flex min-h-0 flex-1 flex-col-reverse overflow-hidden min-[821px]:grid min-[821px]:grid-cols-[minmax(280px,0.9fr)_minmax(360px,1.1fr)]"
        id="auth-content"
      >
        <section
          className="flex min-w-0 flex-col justify-between gap-8 bg-[linear-gradient(105deg,var(--accent)_0%,var(--muted)_100%)] px-[clamp(20px,7vw,52px)] py-9 min-[821px]:px-10 min-[821px]:py-12"
          aria-labelledby="auth-reassurance-title"
        >
          <div>
            <h2
              className="m-0 max-w-[16ch] text-[clamp(2.2rem,9vw,3.4rem)] leading-[0.98] font-bold tracking-[-0.035em] text-balance min-[821px]:max-w-[13ch] min-[821px]:text-[clamp(2.4rem,4vw,3.8rem)]"
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
        <div className="px-[clamp(20px,7vw,52px)] py-9 min-[821px]:px-10 min-[821px]:py-10">
          <div className="mx-auto w-full max-w-[460px]"><AuthForm /></div>
        </div>
      </main>
    </div>
  );
}
