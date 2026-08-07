export function ApprovalPanel({
  summary,
  disabled,
  onDecision,
}: {
  summary: string;
  disabled: boolean;
  onDecision: (approved: boolean) => void;
}) {
  return (
    <div className="mt-4 rounded-2xl bg-muted p-5">
      <h3 className="text-lg font-bold text-foreground">Confirm this action</h3>
      <p className="mt-2 text-base leading-relaxed text-foreground">{summary}</p>
      <p className="mt-2 text-sm text-foreground">
        Nothing happens until you approve.
      </p>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <button
          className="min-h-14 rounded-xl bg-primary px-3 font-bold text-primary-foreground disabled:opacity-50"
          disabled={disabled}
          onClick={() => onDecision(true)}
          type="button"
        >
          Approve action
        </button>
        <button
          className="min-h-14 rounded-xl border border-input bg-background px-3 font-bold text-foreground disabled:opacity-50"
          disabled={disabled}
          onClick={() => onDecision(false)}
          type="button"
        >
          Reject action
        </button>
      </div>
    </div>
  );
}
