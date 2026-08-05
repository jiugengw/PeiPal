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
    <div className="mx-auto min-h-screen w-full overflow-hidden bg-background text-foreground sm:my-4 sm:min-h-[calc(100vh-2rem)] sm:w-[min(1160px,calc(100%-2rem))] sm:rounded-2xl sm:border sm:border-border sm:shadow-[0_20px_60px_rgb(37_44_64_/_0.10)]">
      <a
        className="fixed -top-20 left-5 z-20 rounded-xl bg-background px-4 py-3 text-foreground focus:top-4"
        href="#auth-content"
      >
        Skip to account form
      </a>
      <header className="flex min-h-[82px] items-center justify-between gap-6 border-b border-border px-5 py-3.5 sm:px-[clamp(20px,4vw,48px)] max-[480px]:items-start max-[480px]:flex-col max-[480px]:gap-2">
        <Link
          className="inline-flex items-center gap-3 text-[1.1rem] font-extrabold text-foreground no-underline"
          to="/"
          aria-label="Count Me In home"
        >
          <span
            className="grid size-[46px] place-items-center rounded-xl bg-primary text-primary-foreground"
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
        className="flex min-h-[calc(100vh-115px)] flex-col-reverse min-[821px]:grid min-[821px]:grid-cols-[minmax(280px,0.82fr)_minmax(360px,1.18fr)]"
        id="auth-content"
      >
        <section
          className="flex min-w-0 flex-col justify-between gap-12 bg-[linear-gradient(105deg,var(--accent)_0%,var(--muted)_100%)] px-[clamp(20px,7vw,52px)] py-11 min-[821px]:px-[clamp(28px,5vw,64px)] min-[821px]:py-[clamp(42px,7vw,88px)]"
          aria-labelledby="auth-reassurance-title"
        >
          <div>
            <h2
              className="m-0 max-w-[16ch] text-[clamp(2.2rem,9vw,3.4rem)] leading-[0.98] font-bold tracking-[-0.035em] text-balance min-[821px]:max-w-[12ch] min-[821px]:text-[clamp(2.4rem,4.5vw,4.8rem)]"
              id="auth-reassurance-title"
            >
              A comfortable way to plan with people you trust.
            </h2>
            <p className="mt-6 max-w-[38ch] text-lg leading-relaxed">
              Keep activity ideas together, ask for practical support, and stay
              in control of what gets shared.
            </p>
          </div>
          <p className="mt-auto max-w-[38ch] border-t border-input pt-6 text-lg leading-relaxed font-extrabold">
            Your plans stay private until you choose to share them.
          </p>
        </section>
        <div className="px-[clamp(20px,7vw,52px)] pt-12 pb-14 min-[821px]:px-[clamp(28px,6vw,76px)] min-[821px]:py-[clamp(42px,7vw,88px)]">
          <AuthForm />
        </div>
      </main>
    </div>
  );
}
