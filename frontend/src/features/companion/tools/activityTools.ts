import { z } from "zod";
import { activitiesQueryOptions } from "@/features/activities/api/activityQueries";
import { toActivity } from "@/features/activities/api/toActivity";
import { plansQueryOptions } from "@/features/plans/api/planQueries";
import { planStatusLabels } from "@/features/plans/status";
import type { CompanionToolContext } from "./toolContext";

/** Read-only tools. Each one leaves the matching page on screen. */
export function createActivityTools({
  toolFactory,
  queryClient,
  navigate,
  workflowRef,
  setupRef,
}: CompanionToolContext) {
  return [
    toolFactory({
      name: "find_activities",
      description:
        "Show activities on the discovery page, optionally near a location.",
      parameters: z.object({
        location: z.string().trim().max(120).nullable().optional(),
        limit: z.number().int().min(1).max(3).nullable().optional(),
      }),
      execute: async ({ location, limit }) => {
        const search = location ?? "";
        const count = limit ?? 3;
        await navigate({ to: "/discover" });
        const data = await queryClient.fetchQuery(
          activitiesQueryOptions({ location: search, limit: count }),
        );
        workflowRef.current.searchActivities(search, count);
        const activities = data.activities.map(toActivity).map((item) => ({
          activityId: item.databaseId,
          title: item.title,
          venue: item.venue,
          startsAt: item.startsAt?.toISOString() ?? null,
          cost: item.cost,
        }));
        return {
          display:
            activities.length === 0
              ? "The discovery page shows no matching activities."
              : `The discovery page lists ${activities.length} ${activities.length === 1 ? "activity" : "activities"}${search ? ` near ${search}` : ""}.`,
          activities,
        };
      },
    }),
    toolFactory({
      name: "select_activity",
      description:
        "Choose one of the activities currently listed, by its numeric id.",
      parameters: z.object({ activityId: z.number().int().positive() }),
      execute: async ({ activityId }) => {
        await navigate({ to: "/discover" });
        const activity = workflowRef.current.selectActivityById(activityId);
        if (!activity)
          throw new Error(
            "That activity is not in the visible results. Find activities again first.",
          );
        return {
          display: `${activity.title} is selected and shown above the search bar. Nothing has been shared yet. Use the visible Share the plan button when the person is ready to email the trusted family members.`,
          activityId,
          title: activity.title,
        };
      },
    }),
    toolFactory({
      name: "list_family_members",
      description:
        "List the family members saved in setup, with the ids needed to email them.",
      parameters: z.object({}),
      execute: async () => {
        const contacts = setupRef.current.familyMembers.map((member) => ({
          contactId: member.id,
          name: member.name,
          relationships: member.relationships,
          canBeEmailed: Boolean(member.email),
        }));
        return {
          display:
            contacts.length === 0
              ? "No family members are saved yet; they are added on the setup page."
              : `${contacts.length} family ${contacts.length === 1 ? "member is" : "members are"} saved.`,
          contacts,
        };
      },
    }),
    toolFactory({
      name: "list_plans",
      description:
        "List the family's plans, with the ids needed for any plan action.",
      parameters: z.object({
        status: z
          .enum(["draft", "coordinating", "ready", "completed", "rejected", "cancelled"])
          .nullable()
          .optional(),
      }),
      execute: async ({ status }) => {
        const family = setupRef.current.family;
        if (!family)
          throw new Error("Finish the family step in setup first.");
        const data = await queryClient.fetchQuery(
          plansQueryOptions(family.id, status ?? undefined),
        );
        const plans = data.plans.map((plan) => ({
          planId: plan.id,
          status: plan.status,
          statusLabel: planStatusLabels[plan.status],
          activityId: plan.activity_id,
        }));
        return {
          display:
            plans.length === 0
              ? "There are no plans matching that."
              : `${plans.length} ${plans.length === 1 ? "plan" : "plans"} found.`,
          plans,
        };
      },
    }),
  ];
}
