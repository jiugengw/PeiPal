import { createFileRoute } from "@tanstack/react-router";
import { FamilyPortal } from "@/features/family/FamilyPortal";

export const Route = createFileRoute("/_authenticated/family-portal")({
  component: FamilyPortal,
});
