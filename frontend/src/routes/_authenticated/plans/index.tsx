import { createFileRoute } from "@tanstack/react-router";
import { PlanList } from "@/features/plans/PlanList";

export const Route = createFileRoute("/_authenticated/plans/")({
  component: PlanListPage,
});

function PlanListPage() {
  return <PlanList />;
}
