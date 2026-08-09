import { useEffect } from "react";
import {
  createFileRoute,
  redirect,
  useNavigate,
  useRouter,
} from "@tanstack/react-router";
import familySignInHero from "@/assets/family-sign-in-hero.png";
import { AuthForm } from "@/features/auth/AuthForm";
import { useAuthSession } from "@/features/auth/AuthSessionContext";

export const Route = createFileRoute("/auth")({
  validateSearch: (search: Record<string, unknown>) => ({
    redirect: typeof search.redirect === "string" ? search.redirect : undefined,
  }),
  beforeLoad: ({ context, search }) => {
    if (!context.auth.session) return;

    // "/" decides where each role belongs, so sign-in never guesses.
    const destination =
      search.redirect?.startsWith("/") && !search.redirect.startsWith("/auth")
        ? search.redirect
        : "/";

    throw redirect({ href: destination, replace: true });
  },
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const router = useRouter();
  const search = Route.useSearch();
  const { session } = useAuthSession();

  useEffect(() => {
    if (!session) return;

    const requestedPath = search.redirect;
    if (
      typeof requestedPath === "string" &&
      requestedPath.startsWith("/") &&
      !requestedPath.startsWith("/auth")
    ) {
      router.history.replace(requestedPath);
      return;
    }

    void navigate({ to: "/", replace: true });
  }, [navigate, router.history, search.redirect, session]);

  return (
    <div className="min-h-dvh w-full bg-background text-foreground">
      <main
        className="relative flex min-h-dvh items-center justify-center overflow-hidden px-5 py-8 sm:px-8 sm:py-12"
        id="auth-content"
      >
        <img
          alt=""
          aria-hidden="true"
          className="absolute inset-0 h-full w-full object-cover object-[32%_center] sm:object-center"
          decoding="async"
          fetchPriority="high"
          src={familySignInHero}
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[linear-gradient(180deg,rgb(31_38_56_/_0.10),rgb(47_40_67_/_0.18))]"
        />
        <div className="relative z-10 w-full max-w-[440px] rounded-[16px] bg-background/92 px-6 py-8 shadow-[0_20px_55px_rgb(33_28_50_/_0.24)] sm:px-9 sm:py-10">
          <div className="w-full">
            <p className="mb-6 text-center text-lg font-extrabold tracking-[-0.02em] text-primary">
              PeiPal
            </p>
            <AuthForm variant="elderly" redirect={search.redirect} />
          </div>
        </div>
      </main>
    </div>
  );
}
