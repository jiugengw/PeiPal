import { useQuery } from "@tanstack/react-query";
import {
  familiesQueryOptions,
  familyMembersQueryOptions,
  olderAdultsQueryOptions,
} from "@/features/setup/api/setupQueries";

export function useSetupProgress() {
  const familiesQuery = useQuery(familiesQueryOptions());
  const family = familiesQuery.data?.families?.[0];

  const olderAdultsQuery = useQuery({
    ...olderAdultsQueryOptions(family?.id ?? 0),
    enabled: Boolean(family),
  });
  const olderAdults = olderAdultsQuery.data?.older_adults ?? [];
  const olderAdult = olderAdults[0];

  // Family members belong to the family, not to a single older adult, so one
  // person can support several older adults with a different relationship each.
  const familyMembersQuery = useQuery({
    ...familyMembersQueryOptions(family?.id ?? 0),
    enabled: Boolean(family),
  });
  const familyMembers = familyMembersQuery.data?.family_members ?? [];

  return {
    family,
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
