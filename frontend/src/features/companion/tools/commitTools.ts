import { z } from "zod";
import type { CompanionToolContext } from "./toolContext";

/**
 * Confirming runs the handler behind the button the person can see, so the
 * spoken path and the clicked path are the same code.
 */
export function createCommitTools({
  toolFactory,
  intentRef,
}: CompanionToolContext) {
  return [
    toolFactory({
      name: "confirm_staged_action",
      description:
        "Press the confirm button that is currently on screen. Only call this straight after the person agrees to it.",
      parameters: z.object({}),
      // Cancelling a plan is visible to the whole family, so it keeps a second
      // explicit approval before the companion presses anything.
      needsApproval: async () =>
        intentRef.current.intent?.kind === "confirm_plan_status",
      execute: async () => {
        const intent = intentRef.current.intent;
        if (!intent)
          throw new Error(
            "There is nothing waiting to be confirmed on screen right now.",
          );
        intentRef.current.commit();
        return { display: "The confirmation was pressed.", confirmed: intent.kind };
      },
    }),
    toolFactory({
      name: "cancel_staged_action",
      description:
        "Close the confirmation that is on screen without carrying it out.",
      parameters: z.object({}),
      execute: async () => {
        intentRef.current.clear();
        return { display: "The confirmation was closed. Nothing happened." };
      },
    }),
  ];
}
