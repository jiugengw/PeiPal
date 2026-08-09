import { createFileRoute } from "@tanstack/react-router";
import { FamilyPeople } from "@/features/family/FamilyPeople";
import { OrganizerFamilies } from "@/features/family/OrganizerFamilies";
import { useViewer } from "@/hooks/useViewer";

export const Route = createFileRoute("/_authenticated/family")({
  component: FamilyPage,
});

function FamilyPage() {
  const { role } = useViewer();
  return role === "older_adult" ? <FamilyPeople /> : <OrganizerFamilies />;
}
