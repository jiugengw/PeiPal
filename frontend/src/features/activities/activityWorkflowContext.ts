import { createContext, useContext } from "react";
import type { UseQueryResult } from "@tanstack/react-query";
import type { components } from "@/generated/api";
import type { Activity } from "@/features/activities/types";

export interface ActivityWorkflowValue {
  location: string;
  limit: number;
  activities: Activity[];
  selectedActivity: Activity | null;
  unavailableNotice: string;
  isReviewingPlan: boolean;
  activitiesQuery: UseQueryResult<components["schemas"]["ActivityListResponse"], unknown>;
  searchActivities: (location: string, limit?: number) => void;
  selectActivity: (activity: Activity) => void;
  selectActivityById: (activityId: number) => Activity | null;
  clearSelection: () => void;
  setIsReviewingPlan: (value: boolean) => void;
  markSelectionUnavailable: () => void;
}

export const ActivityWorkflowContext = createContext<ActivityWorkflowValue | undefined>(undefined);

export function useActivityWorkflow() {
  const value = useContext(ActivityWorkflowContext);
  if (!value) throw new Error("useActivityWorkflow must be used inside ActivityWorkflowProvider.");
  return value;
}
