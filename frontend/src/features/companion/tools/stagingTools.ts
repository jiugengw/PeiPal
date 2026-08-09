import { z } from "zod";
import { planQueryOptions } from "@/features/plans/api/planQueries";
import { planPath, PLAN_PATH, type CompanionToolContext } from "./toolContext";

/** Which statuses a plan can legally move to, mirroring the API's state machine. */
// Cancelling is the only status the companion can stage. Approving, rejecting,
// and helping belong to the family members holding their emailed links, and
// asking the family is its own deliberate action on the plan page.
const allowedNextStatuses = {
  draft: ["cancelled"],
  coordinating: ["cancelled"],
  ready: ["cancelled"],
  completed: [],
  rejected: [],
  cancelled: [],
} as const;

/**
 * Staging tools never mutate. They put the person on the right page with the
 * page's own review block filled in, exactly as clicking would have done.
 */
export function createStagingTools({
  toolFactory,
  queryClient,
  navigate,
  workflowRef,
  setupRef,
  intentRef,
}: CompanionToolContext) {
  return [
    toolFactory({
      name: "review_plan",
      description:
        "Show the review panel for making a plan from the selected activity. Creates nothing.",
      parameters: z.object({}),
      execute: async () => {
        const { family, olderAdult } = setupRef.current;
        const activity = workflowRef.current.selectedActivity;
        if (!family || !olderAdult)
          throw new Error("Finish setup before making a plan.");
        if (!activity)
          throw new Error("Select a visible activity before making a plan.");
        await navigate({ to: "/discover" });
        workflowRef.current.setIsReviewingPlan(true);
        intentRef.current.stage({ kind: "review_plan" }, "/discover");
        return {
          display: `The review panel for ${activity.title} is on screen with a "Share the plan" button. Pressing it will send emails to the trusted family members. Nothing is sent until the person presses it.`,
        };
      },
    }),
    toolFactory({
      name: "stage_plan_status",
      description:
        "Open the confirmation for changing a plan's status. Changes nothing on its own.",
      parameters: z.object({
        planId: z.number().int().positive(),
        status: z.enum(["cancelled"]),
      }),
      execute: async ({ planId, status }) => {
        const plan = await queryClient.fetchQuery(planQueryOptions(planId));
        const allowed: readonly string[] = allowedNextStatuses[plan.status];
        if (!allowed.includes(status))
          throw new Error(
            `A plan that is "${plan.status}" cannot become "${status}".`,
          );
        const path = planPath(planId);
        await navigate({ to: PLAN_PATH, params: { planId: String(planId) } });
        intentRef.current.stage(
          { kind: "confirm_plan_status", planId, status },
          path,
        );
        return {
          display: `A confirmation for this change is on screen at ${path}. Nothing changes until it is confirmed.`,
        };
      },
    }),
  ];
}
