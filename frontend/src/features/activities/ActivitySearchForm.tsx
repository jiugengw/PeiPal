import {
  fieldClass,
  labelClass,
  secondaryButtonClass,
} from "@/features/activities/activityStyles";

interface ActivitySearchFormProps {
  query: string;
  onSearch: (query: string) => void;
}

/**
 * Typed alternative to voice for finding an activity. Filtering happens
 * live, client-side, against whatever activities are already loaded - see
 * `matchesActivityQuery` - so there is no submit step or network round trip.
 */
export function ActivitySearchForm({
  query,
  onSearch,
}: ActivitySearchFormProps) {
  function change(nextValue: string) {
    onSearch(nextValue);
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <label className={`${labelClass} flex-1`}>
        Search by activity, neighborhood, or venue
        <input
          className={fieldClass}
          id="activity-search"
          onChange={(event) => change(event.target.value)}
          placeholder="For example, Gentle Yoga or Bishan"
          type="search"
          value={query}
        />
      </label>
      {query ? (
        <button
          className={secondaryButtonClass}
          onClick={() => change("")}
          type="button"
        >
          Clear
        </button>
      ) : null}
    </div>
  );
}
