import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AuthForm } from "@/features/auth/AuthForm";
import { useAuthSession } from "@/features/auth/AuthSessionContext";
import { TextAnimate } from "@/components/ui/text-animate";

export function AuthPage() {
  const navigate = useNavigate();
  const { session } = useAuthSession();

  useEffect(() => {
    if (session) void navigate("/setup", { replace: true });
  }, [navigate, session]);

  return (
    <div className="flex h-dvh w-full flex-col overflow-hidden bg-background text-foreground">
      
      <main
        className="grid min-h-0 flex-1 overflow-hidden lg:grid-cols-[minmax(420px,1fr)_minmax(420px,1fr)]"
        id="auth-content"
      >
        <section
          className="hidden min-w-0 items-center bg-[linear-gradient(105deg,var(--accent)_0%,var(--muted)_100%)] px-[clamp(40px,6vw,88px)] py-12 lg:flex"
        >
          <div className="w-full max-w-[34rem]">
            <TextAnimate
              animation="blurIn"
              as="h2"
              className="m-0 max-w-[14ch] text-[clamp(2.5rem,4vw,3.75rem)] leading-[1.02] font-bold tracking-[-0.035em] text-balance"
              duration={2}
              once
            >
              A comfortable way to plan with people you trust.
            </TextAnimate>
            <p className="mt-6 max-w-[34ch] text-lg leading-relaxed">
              Keep activity ideas together, ask for practical support, and stay
              in control of what gets shared.
            </p>
            <p className="mt-8 max-w-[34ch] border-t border-input pt-5 text-base leading-relaxed font-extrabold">
              Your plans stay private until you choose to share them.
            </p>
          </div>
        </section>
        <div className="grid min-h-0 place-items-center px-4 py-4 sm:px-8 lg:px-12">
          <div className="w-full max-w-[420px]"><AuthForm /></div>
        </div>
      </main>
    </div>
  );
}
