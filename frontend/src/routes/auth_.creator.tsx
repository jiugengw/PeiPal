import { useEffect } from "react";
import {
  createFileRoute,
  Link,
  redirect,
  useNavigate,
  useRouter,
} from "@tanstack/react-router";
import { TextAnimate } from "@/components/ui/text-animate";
import { AuthForm } from "@/features/auth/AuthForm";
import { useAuthSession } from "@/features/auth/AuthSessionContext";

export const Route = createFileRoute("/auth_/creator")({
  validateSearch: (search: Record<string, unknown>) => ({
    redirect: typeof search.redirect === "string" ? search.redirect : undefined,
  }),
  beforeLoad: ({ context, search }) => {
    if (!context.auth.session) return;

    const destination =
      search.redirect?.startsWith("/") && !search.redirect.startsWith("/auth")
        ? search.redirect
        : "/";

    throw redirect({ href: destination, replace: true });
  },
  component: CreatorAuthPage,
});

function CreatorAuthPage() {
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
    <div className="flex min-h-dvh w-full flex-col overflow-y-auto bg-background text-foreground">
      <main
        className="grid min-h-dvh flex-1 overflow-visible lg:grid-cols-[minmax(420px,1fr)_minmax(420px,1fr)]"
        id="auth-content"
      >
        <section className="hidden min-h-full min-w-0 items-center bg-[linear-gradient(105deg,var(--accent)_0%,var(--muted)_100%)] px-[clamp(40px,6vw,88px)] py-12 lg:flex">
          <div className="w-full max-w-[34rem]">
            <TextAnimate
              animation="blurIn"
              as="h2"
              className="m-0 max-w-[14ch] text-[clamp(2.5rem,4vw,3.75rem)] leading-[1.02] font-bold tracking-[-0.035em] text-balance"
              duration={2}
              once
            >
              Set up support for someone you love.
            </TextAnimate>
            <TextAnimate
              animation="fadeIn"
              delay={2}
              className="mt-8 max-w-[34ch] border-t border-input pt-5 text-base leading-relaxed font-extrabold"
            >
              Create or manage the PeiPal account used to set up a family.
            </TextAnimate>
          </div>
        </section>
        <div className="flex min-h-full items-start justify-center px-4 py-8 sm:px-8 sm:py-10 lg:items-center lg:px-12 lg:py-12">
          <div className="w-full max-w-[420px]">
            <AuthForm variant="creator" />
            <Link
              className="mt-5 inline-flex min-h-12 w-full items-center justify-center rounded-xl border-2 border-input bg-background px-4 text-center text-base text-foreground hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
              to="/auth"
              search={{ redirect: search.redirect }}
            >
              Sign in as a senior instead
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
