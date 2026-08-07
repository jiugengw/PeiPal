import { createFileRoute } from "@tanstack/react-router";
import { FamilyPeople } from "@/features/family/FamilyPeople";

export const Route = createFileRoute("/_authenticated/family")({
  component: FamilyPage,
});

function FamilyPage() {
  return <FamilyPeople />;
}
