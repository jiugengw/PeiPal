import { useState } from "react";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { useAuthSession } from "@/features/auth/AuthSessionContext";
import { environment } from "@/services/environment";

export const Route = createFileRoute("/oauth/authorize")({
  validateSearch: (search: Record<string, unknown>) => ({
    client_id: String(search.client_id ?? ""),
    redirect_uri: String(search.redirect_uri ?? ""),
    response_type: String(search.response_type ?? ""),
    code_challenge: String(search.code_challenge ?? ""),
    state: String(search.state ?? ""),
    scope: String(search.scope ?? "activities:read plans:read plans:write"),
  }),
  beforeLoad: ({ context, location }) => {
    if (context.auth.session) return;
    throw redirect({
      to: "/auth",
      search: { redirect: `${location.pathname}${location.searchStr}` },
      replace: true,
    });
  },
  component: OAuthAuthorizePage,
});

function OAuthAuthorizePage() {
  const { session } = useAuthSession();
  const search = Route.useSearch();
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function approve() {
    if (!session) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const apiOrigin = environment.apiBaseUrl || "http://localhost:8000";
      const response = await fetch(`${apiOrigin}/oauth/authorize/approve`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(search),
      });
      if (!response.ok) throw new Error("The authorization request could not be completed.");
      const payload = (await response.json()) as { redirect_url: string };
      window.location.assign(payload.redirect_url);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The authorization request could not be completed.");
      setIsSubmitting(false);
    }
  }

  return (
    <main className="grid min-h-dvh place-items-center bg-[linear-gradient(105deg,var(--muted)_0%,var(--background)_72%)] px-5 py-10 text-foreground">
      <section className="w-full max-w-[560px] rounded-2xl border border-border bg-background p-7 shadow-[0_12px_30px_rgb(37_44_64_/_0.08)] sm:p-10">
        <p className="text-sm font-extrabold uppercase tracking-[0.12em] text-primary">PeiPal connection</p>
        <h1 className="mt-3 text-4xl font-bold leading-tight tracking-[-0.035em]">Let WorkBuddy work with PeiPal?</h1>
        <p className="mt-4 text-lg leading-relaxed">WorkBuddy is requesting access to your PeiPal account.</p>
        <ul className="mt-7 space-y-3 border-y border-border py-5 text-lg">
          <li>Read available activities</li>
          <li>View your plans</li>
          <li>Create plans for your family</li>
        </ul>
        {error ? <p className="mt-5 font-bold text-foreground" role="alert">{error}</p> : null}
        <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:justify-end">
          <button className="min-h-12 rounded-xl border border-input bg-background px-5 font-extrabold text-foreground hover:bg-muted" onClick={() => window.history.back()} type="button">Cancel</button>
          <button className="min-h-12 rounded-xl bg-primary px-5 font-extrabold text-primary-foreground hover:bg-foreground disabled:cursor-wait disabled:opacity-70" disabled={isSubmitting} onClick={() => void approve()} type="button">
            {isSubmitting ? "Connecting…" : "Allow access"}
          </button>
        </div>
      </section>
    </main>
  );
}
