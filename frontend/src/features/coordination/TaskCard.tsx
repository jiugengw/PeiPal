import { useState } from "react";
import type {
  CoordinationAction,
  CoordinationTask,
} from "@/features/coordination/api/coordinationQueries";
import { describeTask } from "@/features/coordination/describeTask";

const primaryButtonClass =
  "inline-flex min-h-14 items-center justify-center rounded-xl bg-primary px-6 font-extrabold text-primary-foreground hover:bg-foreground disabled:cursor-not-allowed disabled:opacity-50";
const secondaryButtonClass =
  "inline-flex min-h-14 items-center justify-center rounded-xl border border-input bg-background px-6 font-extrabold text-foreground hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50";

const TASK_LABELS: Record<CoordinationTask["task_type"], string> = {
  approval: "Approval",
  registration: "Signing up",
  transport: "Getting there",
};

const TASK_DESCRIPTIONS: Record<CoordinationTask["task_type"], string> = {
  approval: "Someone in the family needs to say yes or no.",
  registration: "Someone can book or register a place.",
  transport: "Someone can arrange a way to get there and back.",
};

// Signing up has no separate "offer" step; the page turns this into a claim + complete.
export type TaskCardAction = CoordinationAction | "sign_up_done";

export function TaskCard({
  task,
  respondingAs,
  isApproved,
  isBusy,
  isSettled,
  onAct,
}: {
  task: CoordinationTask;
  respondingAs?: string | null;
  isApproved: boolean;
  isBusy: boolean;
  isSettled: boolean;
  onAct: (action: TaskCardAction, reason?: string) => void;
}) {
  const [confirmingTakeover, setConfirmingTakeover] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");

  const mine = Boolean(task.owner_name && task.owner_name === respondingAs);
  const resolved =
    task.status === "done" ||
    task.status === "not_needed" ||
    task.status === "approved" ||
    task.status === "rejected";

  return (
    <article className="rounded-2xl bg-background p-5 shadow-[0_18px_45px_rgb(37_44_64_/_0.10)] sm:p-6">
      <h3 className="text-xl font-bold text-foreground">
        {TASK_LABELS[task.task_type]}
      </h3>
      <p className="mt-1 text-base leading-relaxed text-foreground">
        {TASK_DESCRIPTIONS[task.task_type]}
      </p>
      <p className="mt-3 text-lg font-bold text-foreground">
        {describeTask(task, respondingAs)}
      </p>
      {task.reason ? (
        <p className="mt-2 text-base leading-relaxed text-foreground">
          They added: {task.reason}
        </p>
      ) : null}

      {resolved || isSettled ? null : task.task_type === "approval" ? (
        rejecting ? (
          <div className="mt-4">
            <label className="block text-base font-extrabold text-foreground">
              Why not this time? (optional)
              <textarea
                className="mt-2 w-full rounded-xl border border-input bg-background px-4 py-3 text-lg text-foreground"
                maxLength={2000}
                onChange={(event) => setReason(event.target.value)}
                rows={3}
                value={reason}
              />
            </label>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <button
                className={primaryButtonClass}
                disabled={isBusy}
                onClick={() => onAct("reject", reason)}
                type="button"
              >
                Confirm no
              </button>
              <button
                className={secondaryButtonClass}
                disabled={isBusy}
                onClick={() => setRejecting(false)}
                type="button"
              >
                Go back
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <button
              className={primaryButtonClass}
              disabled={isBusy}
              onClick={() => onAct("approve")}
              type="button"
            >
              Yes, approve
            </button>
            <button
              className={secondaryButtonClass}
              disabled={isBusy}
              onClick={() => setRejecting(true)}
              type="button"
            >
              No, reject
            </button>
          </div>
        )
      ) : !isApproved ? (
        <p className="mt-4 text-base font-bold text-foreground">
          Waiting for the family to approve this activity before anyone can
          take this on.
        </p>
      ) : (
        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          {mine ? (
            <>
              <button
                className={primaryButtonClass}
                disabled={isBusy}
                onClick={() => onAct("complete")}
                type="button"
              >
                I have done this
              </button>
              <button
                className={secondaryButtonClass}
                disabled={isBusy}
                onClick={() => onAct("release")}
                type="button"
              >
                Cancel role
              </button>
            </>
          ) : task.owner_name ? (
            confirmingTakeover ? (
              <div className="w-full rounded-xl bg-muted p-4">
                <p className="font-bold text-foreground">
                  Take this over from {task.owner_name}?
                </p>
                <p className="mt-1 text-base leading-relaxed text-foreground">
                  They will see that you took it on.
                </p>
                <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                  <button
                    className={primaryButtonClass}
                    disabled={isBusy}
                    onClick={() => onAct("take_over")}
                    type="button"
                  >
                    Yes, take over
                  </button>
                  <button
                    className={secondaryButtonClass}
                    disabled={isBusy}
                    onClick={() => setConfirmingTakeover(false)}
                    type="button"
                  >
                    Leave it with them
                  </button>
                </div>
              </div>
            ) : (
              <button
                className={secondaryButtonClass}
                disabled={isBusy}
                onClick={() => setConfirmingTakeover(true)}
                type="button"
              >
                Take this over
              </button>
            )
          ) : task.task_type === "registration" ? (
            <>
              <button
                className={primaryButtonClass}
                disabled={isBusy}
                onClick={() => onAct("sign_up_done")}
                type="button"
              >
                I have done this
              </button>
              <button
                className={secondaryButtonClass}
                disabled={isBusy}
                onClick={() => onAct("not_needed")}
                type="button"
              >
                Not needed
              </button>
            </>
          ) : (
            <>
              <button
                className={primaryButtonClass}
                disabled={isBusy}
                onClick={() => onAct("claim")}
                type="button"
              >
                I can do this
              </button>
              <button
                className={secondaryButtonClass}
                disabled={isBusy}
                onClick={() => onAct("not_needed")}
                type="button"
              >
                Not needed
              </button>
            </>
          )}
        </div>
      )}
    </article>
  );
}
