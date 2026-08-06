import { createFileRoute } from "@tanstack/react-router";
import { PlanDetail } from "@/features/plans/PlanDetail";

export const Route = createFileRoute("/_authenticated/plans/$planId")({
  component: PlanDetailRoute,
});

function PlanDetailRoute() {
  const { planId } = Route.useParams();
  return <PlanDetail planId={Number(planId)} />;
}
