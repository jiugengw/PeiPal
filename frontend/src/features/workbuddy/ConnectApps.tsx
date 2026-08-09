import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  revokeWorkBuddyConnection,
  workbuddyConnectionsQueryKey,
  workbuddyConnectionsQueryOptions,
} from "@/features/workbuddy/api/workbuddyConnectionQueries";
import { environment } from "@/services/environment";

const primaryButtonClass =
  "inline-flex min-h-12 items-center justify-center rounded-xl border-0 bg-primary px-6 font-extrabold text-primary-foreground hover:bg-foreground disabled:cursor-wait disabled:opacity-70";
const secondaryButtonClass =
  "inline-flex min-h-11 items-center justify-center rounded-xl border border-input bg-background px-4 font-extrabold text-foreground hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60";

/** Manages OAuth connections. WorkBuddy starts the authorization flow itself. */
export function ConnectApps() {
  const queryClient = useQueryClient();
  const connectionsQuery = useQuery(workbuddyConnectionsQueryOptions());
  const [copied, setCopied] = useState(false);
  const revoke = useMutation({
    mutationFn: revokeWorkBuddyConnection,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: workbuddyConnectionsQueryKey }),
  });

  async function copyMcpUrl() {
    await navigator.clipboard.writeText(environment.mcpUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  const connections = connectionsQuery.data ?? [];

  return (
    <section className="min-h-full bg-[linear-gradient(105deg,var(--muted)_0%,var(--background)_72%)] px-5 py-8 sm:px-8 lg:px-12 lg:py-12">
      <div className="mx-auto w-full max-w-[900px]">
        <header className="border-b border-border pb-8">
          <h1 className="max-w-[20ch] text-4xl font-bold leading-[0.98] tracking-[-0.035em] text-balance text-foreground sm:text-5xl">
            Connected apps
          </h1>
          <p className="mt-4 max-w-[65ch] text-lg leading-relaxed text-foreground">
            Manage the apps that can work with PeiPal on your behalf. WorkBuddy
            asks you to sign in and approve access when you connect it; no token
            needs to be copied here.
          </p>
        </header>

        <section className="mt-8 rounded-2xl border border-border bg-background p-6 shadow-[0_12px_30px_rgb(37_44_64_/_0.08)] sm:p-8">
          <h2 className="text-2xl font-bold text-foreground">Connect WorkBuddy</h2>
          <p className="mt-3 max-w-[65ch] text-lg leading-relaxed text-foreground">
            In WorkBuddy, add a custom MCP server and paste this address. WorkBuddy
            will open PeiPal for sign-in and permission approval.
          </p>
          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
            <code className="min-h-12 flex-1 break-all rounded-xl bg-muted px-4 py-3 text-base text-foreground">
              {environment.mcpUrl}
            </code>
            <button className={primaryButtonClass} onClick={() => void copyMcpUrl()} type="button">
              {copied ? "Copied" : "Copy address"}
            </button>
          </div>
          <p className="mt-4 text-base text-foreground">
            Permissions: read activities, view plans, and create plans for your family.
          </p>
        </section>

        <section className="mt-10">
          <h2 className="text-2xl font-bold text-foreground">Active connections</h2>
          {connectionsQuery.isPending ? (
            <p className="mt-4 text-lg text-foreground" role="status">Checking your connections…</p>
          ) : connectionsQuery.isError ? (
            <p className="mt-4 text-lg text-foreground" role="alert">We could not load your connections. Try again.</p>
          ) : connections.length === 0 ? (
            <p className="mt-4 rounded-2xl bg-background p-6 text-lg text-foreground">No apps are connected yet.</p>
          ) : (
            <ul className="mt-4 divide-y divide-border border-y border-border bg-background">
              {connections.map((connection) => (
                <li className="flex flex-wrap items-center justify-between gap-4 px-5 py-5 sm:px-7" key={connection.client_id}>
                  <div>
                    <strong className="text-xl text-foreground">WorkBuddy</strong>
                    <p className="mt-1 text-base text-foreground">
                      Connected {new Date(connection.created_at).toLocaleDateString()} · Can create plans
                    </p>
                  </div>
                  <button
                    className={secondaryButtonClass}
                    disabled={revoke.isPending}
                    onClick={() => revoke.mutate(connection.client_id)}
                    type="button"
                  >
                    Revoke access
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </section>
  );
}
