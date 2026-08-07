import { z } from "zod";
import { planPath, PLAN_PATH, type CompanionToolContext } from "./toolContext";

const pageLabels = {
  discover: "the activity list",
  setup: "the setup steps",
  family: "the demo family view",
  plan: "the plan page",
} as const;

/** Moves the person to a page so the screen matches what is being discussed. */
export function createNavigationTools({
  toolFactory,
  navigate,
}: CompanionToolContext) {
  return [
    toolFactory({
      name: "open_page",
      description:
        "Open one of the app's pages so the person can see it. Use this before talking about anything that lives on another page.",
      parameters: z.object({
        page: z.enum(["discover", "setup", "family", "plan"]),
        planId: z.number().int().positive().nullable().optional(),
      }),
      execute: async ({ page, planId }) => {
        if (page === "plan") {
          if (!planId)
            throw new Error("Opening a plan page needs the plan's id.");
          await navigate({
            to: PLAN_PATH,
            params: { planId: String(planId) },
          });
          return { display: `The plan page is open at ${planPath(planId)}.` };
        }
        await navigate({ to: `/${page}` });
        return { display: `${pageLabels[page]} is now on screen.` };
      },
    }),
  ];
}
