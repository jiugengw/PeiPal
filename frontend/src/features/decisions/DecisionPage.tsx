import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  decisionQueryOptions,
  DecisionRequestError,
  submitDecision,
  type PlanDecision,
} from "@/features/decisions/api/decisionQueries";
import { formatDecisionWhen } from "@/features/decisions/format";

const primaryButtonClass =
  "inline-flex min-h-14 items-center justify-center rounded-xl bg-primary px-6 font-extrabold text-primary-foreground hover:bg-foreground disabled:cursor-not-allowed disabled:opacity-50";
const secondaryButtonClass =
  "inline-flex min-h-14 items-center justify-center rounded-xl border border-input bg-background px-6 font-extrabold text-foreground hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50";

/**
 * The page a family member lands on from their email. It is deliberately
 * reachable without an account: the signed token in the link is the identity.
 */
export function DecisionPage({ token }: { token: string }) {
  const invitationQuery = useQuery(decisionQueryOptions(token));
  const [choice, setChoice] = useState<"approved" | "rejected">();
  const [reason, setReason] = useState("");
  const [result, setResult] = useState<PlanDecision>();

  const decide = useMutation({
    mutationFn: (decision: "approved" | "rejected") =>
      submitDecision(token, decision, reason),
    onSuccess: setResult,
  });

  if (invitationQuery.isPending) {
    return <DecisionMessage title="Opening this request…" status />;
  }

  if (invitationQuery.isError) {
    const error = invitationQuery.error;
    const isGone =
      error instanceof DecisionRequestError &&
      (error.status === 404 || error.status === 410);
    return (
      <DecisionMessage
        title={
          isGone
            ? "This decision link is no longer valid."
            : "We could not open this decision link."
        }
        detail={
          isGone
            ? "It may have expired, or the family may have already decided. You can ask them to send a new one."
            : "Please check your connection and try again."
        }
        action={
          isGone ? undefined : (
            <button
              className={primaryButtonClass}
              onClick={() => void invitationQuery.refetch()}
              type="button"
            >
              Try again
            </button>
          )
        }
      />
    );
  }

  const invitation = invitationQuery.data;

  if (result) {
    return <DecisionResult result={result} olderAdult={invitation.older_adult} />;
  }

  // Someone else in the family already answered: first decision wins.
  if (!invitation.can_decide) {
    return (
      <DecisionMessage
        title="This request has already been decided."
        detail={`Someone in the family answered before you. ${invitation.older_adult} has already been told what was decided, so there is nothing left for you to do.`}
      />
    );
  }

  return (
    <section className="min-h-full bg-[linear-gradient(105deg,var(--muted)_0%,var(--background)_72%)] px-5 py-8 sm:px-8 lg:py-12">
      <div className="mx-auto w-full max-w-[720px]">
        <header>
          <p className="text-lg font-bold text-foreground">
            Hello {invitation.family_member}
          </p>
          <h1 className="mt-3 text-4xl font-bold leading-[1.02] tracking-[-0.035em] text-balance text-foreground sm:text-5xl">
            {invitation.older_adult} would like to join an activity.
          </h1>
          <p className="mt-4 text-lg leading-relaxed text-foreground">
            Your whole family received this request. The first person to answer
            decides for everyone, so you only need to reply if you are ready.
          </p>
        </header>

        <div className="mt-8 rounded-2xl bg-background p-6 shadow-[0_18px_45px_rgb(37_44_64_/_0.10)]">
          <h2 className="text-2xl font-bold text-foreground">
            {invitation.activity.name}
          </h2>
          <dl className="mt-4 divide-y divide-border border-y border-border text-base text-foreground">
            <DetailRow
              label="When"
              value={formatDecisionWhen(invitation.activity.start_at)}
            />
            <DetailRow label="Where" value={invitation.activity.location} />
            <DetailRow label="For" value={invitation.older_adult} />
          </dl>
          <a
            className="mt-4 inline-block text-lg font-bold text-foreground underline"
            href={invitation.activity.info_link}
            rel="noreferrer"
            target="_blank"
          >
            More about this activity
          </a>
        </div>

        {!choice ? (
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <button
              className={primaryButtonClass}
              onClick={() => setChoice("approved")}
              type="button"
            >
              Approve this request
            </button>
            <button
              className={secondaryButtonClass}
              onClick={() => setChoice("rejected")}
              type="button"
            >
              Reject this request
            </button>
          </div>
        ) : (
          <div className="mt-8 rounded-2xl bg-muted p-6">
            <h2 className="text-xl font-bold text-foreground">
              {choice === "approved"
                ? `Approve ${invitation.activity.name} for ${invitation.older_adult}?`
                : `Reject ${invitation.activity.name} for ${invitation.older_adult}?`}
            </h2>
            <p className="mt-2 text-base leading-relaxed text-foreground">
              Everyone in the family, and {invitation.older_adult}, will be told
              what you decided.
            </p>
            <label className="mt-5 block text-base font-extrabold text-foreground">
              Anything you would like to add? (optional)
              <textarea
                className="mt-2 w-full rounded-xl border border-input bg-background px-4 py-3 text-lg text-foreground"
                maxLength={2000}
                onChange={(event) => setReason(event.target.value)}
                rows={3}
                value={reason}
              />
            </label>
            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              <button
                className={primaryButtonClass}
                disabled={decide.isPending}
                onClick={() => decide.mutate(choice)}
                type="button"
              >
                {decide.isPending
                  ? "Sending…"
                  : choice === "approved"
                    ? "Yes, approve"
                    : "Yes, reject"}
              </button>
              <button
                className={secondaryButtonClass}
                disabled={decide.isPending}
                onClick={() => setChoice(undefined)}
                type="button"
              >
                Go back
              </button>
            </div>
            {decide.isError ? (
              <p className="mt-4 font-bold text-foreground" role="alert">
                {decide.error instanceof DecisionRequestError &&
                decide.error.status === 409
                  ? "Someone in the family answered first, so this request is already decided."
                  : decide.error.message}
              </p>
            ) : null}
          </div>
        )}
      </div>
    </section>
  );
}

function DecisionResult({
  result,
  olderAdult,
}: {
  result: PlanDecision;
  olderAdult: string;
}) {
  const approved = result.status === "approved";
  const failed = (result.deliveries ?? []).filter(
    (delivery) => delivery.status === "failed",
  );
  return (
    <section className="grid min-h-full place-items-center px-6 py-12">
      <div className="w-full max-w-[640px]">
        <h1 className="text-4xl font-bold leading-[1.02] tracking-[-0.035em] text-balance text-foreground">
          {approved
            ? `You approved this activity for ${olderAdult}.`
            : `You rejected this activity for ${olderAdult}.`}
        </h1>
        <dl className="mt-6 divide-y divide-border border-y border-border text-base text-foreground">
          <DetailRow
            label="Decision"
            value={approved ? "Approved" : "Rejected"}
          />
          <DetailRow label="Decided by" value={result.decided_by} />
          <DetailRow
            label="Decided at"
            value={formatDecisionWhen(result.decided_at)}
          />
        </dl>
        <p className="mt-6 text-lg leading-relaxed text-foreground" role="status">
          {result.message}
        </p>
        {failed.length > 0 ? (
          <div className="mt-4 rounded-2xl bg-muted p-5" role="alert">
            <p className="font-bold text-foreground">
              These people could not be reached by email:
            </p>
            <ul className="mt-2 list-disc pl-6 text-base text-foreground">
              {failed.map((delivery) => (
                <li key={`${delivery.recipient_role}-${delivery.name}`}>
                  {delivery.name}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 py-4">
      <dt className="font-bold">{label}</dt>
      <dd className="text-right">{value}</dd>
    </div>
  );
}

function DecisionMessage({
  title,
  detail,
  action,
  status = false,
}: {
  title: string;
  detail?: string;
  action?: React.ReactNode;
  status?: boolean;
}) {
  return (
    <section className="grid min-h-full place-items-center px-6 py-12 text-center">
      <div className="max-w-[560px]">
        <h1
          className="text-3xl font-bold text-foreground"
          {...(status ? { role: "status" } : {})}
        >
          {title}
        </h1>
        {detail ? (
          <p className="mt-4 text-lg leading-relaxed text-foreground">
            {detail}
          </p>
        ) : null}
        {action ? <div className="mt-6">{action}</div> : null}
      </div>
    </section>
  );
}
