import { createFileRoute } from "@tanstack/react-router";
import { SetupWizard } from "@/features/setup/SetupWizard";

function readFamilyId(value: unknown): number | undefined {
  if (typeof value !== "string" || value.trim() === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export const Route = createFileRoute("/_authenticated/setup")({
  // No familyId in the URL means "add a new family" - see SetupWizard's
  // default. A familyId means editing that specific one.
  validateSearch: (search: Record<string, unknown>): { familyId?: number } => {
    const familyId = readFamilyId(search.familyId);
    return familyId === undefined ? {} : { familyId };
  },
  component: SetupPage,
});

function SetupPage() {
  const { familyId } = Route.useSearch();
  return <SetupWizard familyId={familyId ?? null} />;
}
