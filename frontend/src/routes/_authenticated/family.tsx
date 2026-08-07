import { createFileRoute } from "@tanstack/react-router";
import { FamilyView } from "@/features/family/FamilyView";

export const Route = createFileRoute("/_authenticated/family")({
  component: FamilyPage,
});

function FamilyPage() {
  return <FamilyView />;
}
