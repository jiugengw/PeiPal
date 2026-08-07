import { useState, type FormEvent } from "react";
import {
  fieldClass,
  labelClass,
  primaryButtonClass,
  secondaryButtonClass,
} from "@/features/activities/activityStyles";

interface LocationSearchFormProps {
  location: string;
  onSearch: (location: string) => void;
}

/**
 * Typed alternative to voice for narrowing activity results by neighborhood or venue.
 * Submits through the same `onSearch` handler used elsewhere, so it stays in sync
 * with any other way the location filter can change (for example, clearing it from
 * the empty state).
 */
export function LocationSearchForm({
  location,
  onSearch,
}: LocationSearchFormProps) {
  const [value, setValue] = useState(location);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSearch(value.trim());
  }

  function clear() {
    setValue("");
    onSearch("");
  }

  return (
    <form
      className="flex flex-col gap-3 sm:flex-row sm:items-end"
      onSubmit={submit}
    >
      <label className={`${labelClass} flex-1`}>
        Search by neighborhood or venue
        <input
          className={fieldClass}
          id="activity-location"
          onChange={(event) => setValue(event.target.value)}
          placeholder="For example, Bishan or Toa Payoh"
          type="search"
          value={value}
        />
      </label>
      <div className="flex gap-3">
        <button className={primaryButtonClass} type="submit">
          Search
        </button>
        {location ? (
          <button
            className={secondaryButtonClass}
            onClick={clear}
            type="button"
          >
            Clear
          </button>
        ) : null}
      </div>
    </form>
  );
}
