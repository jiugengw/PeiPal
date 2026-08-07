import { useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  activitiesQueryOptions,
  DEFAULT_ACTIVITY_RESULTS_LIMIT,
} from "@/features/activities/api/activityQueries";
import { toActivity } from "@/features/activities/api/toActivity";
import { ActivityWorkflowContext } from "@/features/activities/activityWorkflowContext";
import type { Activity } from "@/features/activities/types";

export function ActivityWorkflowProvider({ children }: { children: ReactNode }) {
  const [location, setLocation] = useState("");
  const [limit, setLimit] = useState(DEFAULT_ACTIVITY_RESULTS_LIMIT);
  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null);
  const [unavailableNotice, setUnavailableNotice] = useState("");
  const [isReviewingPlan, setIsReviewingPlan] = useState(false);
  const activitiesQuery = useQuery(activitiesQueryOptions({ location, limit }));
  const activities = (activitiesQuery.data?.activities ?? []).map(toActivity);
  const selectionUnavailable = Boolean(
    selectedActivity &&
      !activitiesQuery.isPending &&
      !activitiesQuery.isError &&
      !activities.some((activity) => activity.dedupeKey === selectedActivity.dedupeKey),
  );

  function searchActivities(nextLocation: string, nextLimit = DEFAULT_ACTIVITY_RESULTS_LIMIT) {
    setUnavailableNotice("");
    setLocation(nextLocation);
    setLimit(nextLimit);
  }

  function selectActivity(activity: Activity) {
    setUnavailableNotice("");
    setSelectedActivity(activity);
    setIsReviewingPlan(false);
  }

  function selectActivityById(activityId: number) {
    const activity = activities.find((item) => item.databaseId === activityId) ?? null;
    if (activity) selectActivity(activity);
    return activity;
  }

  function clearSelection() {
    setSelectedActivity(null);
    setIsReviewingPlan(false);
  }

  function markSelectionUnavailable() {
    clearSelection();
    setUnavailableNotice("That activity is no longer available. Choose another one below.");
  }

  return <ActivityWorkflowContext.Provider value={{
    location,
    limit,
    activities,
    selectedActivity: selectionUnavailable ? null : selectedActivity,
    unavailableNotice: selectionUnavailable ? "That activity is no longer available. Choose another one below." : unavailableNotice,
    isReviewingPlan,
    activitiesQuery,
    searchActivities,
    selectActivity,
    selectActivityById,
    clearSelection,
    setIsReviewingPlan,
    markSelectionUnavailable,
  }}>{children}</ActivityWorkflowContext.Provider>;
}
