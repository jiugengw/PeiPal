import type { Activity } from "@/features/activities/types";
import {
  formatActivityCost,
  formatActivityWhen,
} from "@/features/activities/format";
import {
  primaryButtonClass,
  secondaryButtonClass,
} from "@/features/activities/activityStyles";

interface SelectedActivityPanelProps {
  activity: Activity | null;
  onClear: () => void;
}

export function SelectedActivityPanel({
  activity,
  onClear,
}: SelectedActivityPanelProps) {
  if (!activity) {
    return (
      <div className="rounded-2xl border border-border bg-background p-6">
        <h2 className="text-lg font-bold text-foreground">
          No activity chosen yet
        </h2>
        <p className="mt-2 text-base leading-relaxed text-foreground">
          Choose an activity from the list to see the full details here.
        </p>
        <button
          className={`${primaryButtonClass} mt-5 w-full`}
          disabled
          type="button"
        >
          Make a plan
        </button>
        <p className="mt-3 text-sm text-foreground">
          Choose an activity first to make a plan.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-background p-6 shadow-[0_18px_45px_rgb(37_44_64_/_0.10)]">
      <p className="text-sm font-extrabold tracking-[0.02em] text-foreground/70 uppercase">
        Selected activity
      </p>
      <h2 className="mt-1 text-2xl font-bold text-foreground">
        {activity.title}
      </h2>

      <dl className="mt-4 space-y-2 text-base text-foreground">
        <div className="flex justify-between gap-3">
          <dt className="font-bold">When</dt>
          <dd className="text-right">{formatActivityWhen(activity)}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="font-bold">Where</dt>
          <dd className="text-right">{activity.venue}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="font-bold">Cost</dt>
          <dd className="text-right">{formatActivityCost(activity)}</dd>
        </div>
      </dl>

      {activity.description ? (
        <p className="mt-4 text-base leading-relaxed text-foreground">
          {activity.description}
        </p>
      ) : null}
      {activity.mobilityNotes ? (
        <p className="mt-3 text-base leading-relaxed text-foreground">
          <strong>Mobility:</strong> {activity.mobilityNotes}
        </p>
      ) : null}

      <div className="mt-6 space-y-3">
        <button
          className={`${primaryButtonClass} w-full`}
          disabled
          type="button"
        >
          Make a plan
        </button>
        <p className="text-sm text-foreground">
          Plan creation is coming in the next step. Nothing is sent yet.
        </p>
        <button
          className={`${secondaryButtonClass} w-full`}
          onClick={onClear}
          type="button"
        >
          Choose a different activity
        </button>
      </div>
    </div>
  );
}
