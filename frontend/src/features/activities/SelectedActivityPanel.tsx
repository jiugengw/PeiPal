import type { Activity } from "@/features/activities/types";
import {
  primaryButtonClass,
  secondaryButtonClass,
} from "@/features/activities/activityStyles";

interface SelectedActivityPanelProps {
  activity: Activity | null;
  canMakePlan?: boolean;
  onClear: () => void;
  onMakePlan?: () => void;
}

export function SelectedActivityPanel({
  activity,
  canMakePlan = false,
  onClear,
  onMakePlan,
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
    <section
      aria-label={`${activity.title} planning options`}
      className="mt-5 rounded-[16px] bg-muted p-5 sm:p-6"
    >
      {activity.description ? (
        <p className="max-w-[65ch] text-base leading-relaxed text-foreground">
          {activity.description}
        </p>
      ) : null}
      {activity.infoLink ? (
        <a
          className="mt-3 inline-block font-bold text-primary underline"
          href={activity.infoLink}
          rel="noopener noreferrer"
          target="_blank"
        >
          More information (opens in a new tab)
        </a>
      ) : null}
      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <button
          className={`${primaryButtonClass} w-full sm:w-auto`}
          disabled={!canMakePlan}
          onClick={onMakePlan}
          type="button"
        >
          Make a plan
        </button>
        <button
          className={`${secondaryButtonClass} w-full sm:w-auto`}
          onClick={onClear}
          type="button"
        >
          Choose a different activity
        </button>
      </div>
      <p className="mt-3 text-sm text-foreground">
        Review the details before creating anything. No email is sent yet.
      </p>
    </section>
  );
}
