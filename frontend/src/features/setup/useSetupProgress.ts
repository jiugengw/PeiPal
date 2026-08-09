import { useQuery } from "@tanstack/react-query";
import {
  familiesQueryOptions,
  familyMembersQueryOptions,
  olderAdultsQueryOptions,
} from "@/features/setup/api/setupQueries";

/**
 * `selectedFamilyId`:
 *  - omitted entirely -> the caller's first (usually only) family. Correct
 *    for an older adult, who only ever has one, and for any legacy caller
 *    that only ever dealt with a single family.
 *  - a number -> that specific family, looked up from the organizer's own
 *    family list (an organizer can now have several).
 *  - null -> explicitly no family yet. Used by the setup wizard's "add a
 *    new family" flow, so it never accidentally lands on the first existing
 *    family in the list instead of starting fresh.
 */
export function useSetupProgress(
  selectedFamilyId?: number | null,
  enabled: boolean = true,
) {
  const familiesQuery = useQuery({ ...familiesQueryOptions(), enabled });
  const families = familiesQuery.data?.families ?? [];
  const family =
    selectedFamilyId === null
      ? undefined
      : selectedFamilyId === undefined
        ? families[0]
        : families.find((candidate) => candidate.id === selectedFamilyId);

  const olderAdultsQuery = useQuery({
    ...olderAdultsQueryOptions(family?.id ?? 0),
    enabled: enabled && Boolean(family),
  });
  const olderAdults = olderAdultsQuery.data?.older_adults ?? [];
  const olderAdult = olderAdults[0];

  // Family members belong to the family, not to a single older adult, so one
  // person can support several older adults with a different relationship each.
  const familyMembersQuery = useQuery({
    ...familyMembersQueryOptions(family?.id ?? 0),
    enabled: enabled && Boolean(family),
  });
  const familyMembers = familyMembersQuery.data?.family_members ?? [];

  return {
    family,
    families,
    olderAdult,
    olderAdults,
    familyMembers,
    familiesQuery,
    olderAdultsQuery,
    familyMembersQuery,
    isPending:
      familiesQuery.isPending ||
      (Boolean(family) && olderAdultsQuery.isPending) ||
      (Boolean(family) && familyMembersQuery.isPending),
    isError:
      familiesQuery.isError ||
      olderAdultsQuery.isError ||
      familyMembersQuery.isError,
    isComplete: Boolean(family && olderAdult && familyMembers.length > 0),
  };
}
