import type { components } from "@/generated/api";

/**
 * An action the companion agent has teed up for the person to confirm.
 *
 * The agent never mutates. It stages the same state a click would produce, the
 * owning panel renders its own review block, and the mutation stays in the panel
 * so the spoken path and the clicked path run identical code.
 */
export type PlanStatusIntent = components["schemas"]["PlanUpdate"]["status"];
export type SupportTypeIntent =
  components["schemas"]["SupportOfferCreate"]["support_type"];

export type StagedIntentPayload =
  | { kind: "review_plan" }
  | { kind: "confirm_plan_status"; planId: number; status: PlanStatusIntent }
  | {
      kind: "select_notification_recipients";
      planId: number;
      contactIds: number[];
    }
  | {
      kind: "offer_support";
      planId: number;
      supportType: SupportTypeIntent;
      note: string;
    };

export type StagedIntentKind = StagedIntentPayload["kind"];

/**
 * `path` is the route the intent belongs to. Tools await navigation before
 * staging, so the provider can drop the intent as soon as the person leaves.
 */
export type StagedIntent = StagedIntentPayload & { id: string; path: string };

export type StagedIntentOf<K extends StagedIntentKind> = Extract<
  StagedIntent,
  { kind: K }
>;
