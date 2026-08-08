import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createWorkBuddyToken,
  revokeWorkBuddyToken,
  workbuddyTokensQueryKey,
  workbuddyTokensQueryOptions,
  type WorkBuddyToken,
} from "@/features/workbuddy/api/workbuddyTokenQueries";

const primaryButtonClass =
  "inline-flex min-h-12 items-center justify-center rounded-xl border-0 bg-primary px-6 font-extrabold text-primary-foreground hover:bg-foreground disabled:cursor-wait disabled:opacity-70";
const secondaryButtonClass =
  "inline-flex min-h-11 items-center justify-center rounded-xl border border-input bg-background px-4 font-extrabold text-foreground hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60";

/** Lets a caregiver generate a personal access token for WorkBuddy, ChatGPT, or
 * any other app that speaks MCP, without ever typing a password into that app. */
export function ConnectApps() {
  const queryClient = useQueryClient();
  const tokensQuery = useQuery(workbuddyTokensQueryOptions());
  const [name, setName] = useState("");
  const [freshToken, setFreshToken] = useState<{ name: string; token: string } | null>(null);

  const create = useMutation({
    mutationFn: (tokenName: string) => createWorkBuddyToken(tokenName),
    onSuccess: (data) => {
      setFreshToken({ name: data.name, token: data.token });
      setName("");
      void queryClient.invalidateQueries({ queryKey: workbuddyTokensQueryKey });
    },
  });

  const revoke = useMutation({
    mutationFn: (tokenId: number) => revokeWorkBuddyToken(tokenId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: workbuddyTokensQueryKey });
    },
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim()) return;
    create.mutate(name.trim());
  }

  const tokens = tokensQuery.data ?? [];

  return (
    <section className="min-h-full bg-[linear-gradient(105deg,var(--muted)_0%,var(--background)_72%)] px-5 py-8 sm:px-8 lg:px-12 lg:py-12">
      <div className="mx-auto w-full max-w-[900px]">
        <header className="border-b border-border pb-8">
          <h1 className="max-w-[20ch] text-4xl font-bold leading-[0.98] tracking-[-0.035em] text-balance text-foreground sm:text-5xl">
            Connect an app
          </h1>
          <p className="mt-4 max-w-[65ch] text-lg leading-relaxed text-foreground">
            Generate a token for WorkBuddy, ChatGPT, or another app that supports
            PeiPal, and paste it into that app's own connection settings. You
            never give it your password, and you can revoke access here at any
            time.
          </p>
        </header>

        {freshToken ? (
          <div className="mt-8 rounded-2xl border-2 border-foreground bg-background p-6">
            <p className="text-lg font-extrabold text-foreground">
              {freshToken.name} — copy this now
            </p>
            <p className="mt-1 text-base text-foreground">
              This is the only time you will see the full token.
            </p>
            <code className="mt-4 block break-all rounded-xl bg-muted p-4 text-base text-foreground">
              {freshToken.token}
            </code>
            <div className="mt-4 flex gap-3">
              <button
                className={secondaryButtonClass}
                onClick={() => void navigator.clipboard.writeText(freshToken.token)}
                type="button"
              >
                Copy
              </button>
              <button className={secondaryButtonClass} onClick={() => setFreshToken(null)} type="button">
                Done
              </button>
            </div>
          </div>
        ) : null}

        <form className="mt-8 flex flex-col gap-3 sm:flex-row" onSubmit={handleSubmit}>
          <label className="sr-only" htmlFor="token-name">
            Name this app
          </label>
          <input
            className="min-h-12 w-full rounded-xl border-2 border-input bg-background px-4 text-base text-foreground hover:border-primary disabled:cursor-not-allowed disabled:opacity-60"
            disabled={create.isPending}
            id="token-name"
            onChange={(event) => setName(event.target.value)}
            placeholder="e.g. WorkBuddy"
            type="text"
            value={name}
          />
          <button className={primaryButtonClass} disabled={create.isPending || !name.trim()} type="submit">
            {create.isPending ? "Generating…" : "Generate token"}
          </button>
        </form>
        {create.isError ? (
          <p className="mt-3 font-bold text-foreground" role="alert">
            We could not create that token. Try again.
          </p>
        ) : null}

        <div className="mt-10">
          {tokensQuery.isPending ? (
            <p className="text-lg text-foreground" role="status">
              Loading your connected apps…
            </p>
          ) : tokensQuery.isError ? (
            <p className="text-lg text-foreground">We could not load your connected apps.</p>
          ) : tokens.length === 0 ? (
            <p className="rounded-2xl bg-background p-6 text-lg text-foreground">
              No apps connected yet.
            </p>
          ) : (
            <ul className="divide-y divide-border border-y border-border bg-background">
              {tokens.map((token) => (
                <TokenRow
                  key={token.id}
                  onRevoke={() => revoke.mutate(token.id)}
                  revoking={revoke.isPending}
                  token={token}
                />
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}

function TokenRow({
  token,
  onRevoke,
  revoking,
}: {
  token: WorkBuddyToken;
  onRevoke: () => void;
  revoking: boolean;
}) {
  const isRevoked = Boolean(token.revoked_at);
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 px-5 py-5 sm:px-7">
      <div>
        <strong className="text-xl text-foreground">{token.name}</strong>
        <p className="mt-1 text-base text-foreground">
          {isRevoked ? "Revoked" : `Created ${new Date(token.created_at).toLocaleDateString()}`}
        </p>
      </div>
      {isRevoked ? null : (
        <button className={secondaryButtonClass} disabled={revoking} onClick={onRevoke} type="button">
          Revoke
        </button>
      )}
    </li>
  );
}
