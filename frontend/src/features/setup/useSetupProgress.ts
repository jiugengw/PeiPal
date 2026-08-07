import { useQuery } from "@tanstack/react-query";
import {
  householdsQueryOptions,
  olderAdultsQueryOptions,
  trustedContactsQueryOptions,
} from "@/features/setup/api/setupQueries";

export function useSetupProgress(enabled: boolean = true) {
  const householdsQuery = useQuery({ ...householdsQueryOptions(), enabled });
  const household = householdsQuery.data?.households[0];

  const olderAdultsQuery = useQuery({
    ...olderAdultsQueryOptions(household?.id ?? 0),
    enabled: enabled && Boolean(household),
  });
  const olderAdult = olderAdultsQuery.data?.older_adults[0];

  const trustedContactsQuery = useQuery({
    ...trustedContactsQueryOptions(olderAdult?.id ?? 0),
    enabled: enabled && Boolean(olderAdult),
  });
  const contacts = trustedContactsQuery.data?.trusted_contacts ?? [];

  return {
    household,
    olderAdult,
    contacts,
    householdsQuery,
    olderAdultsQuery,
    trustedContactsQuery,
    isPending:
      householdsQuery.isPending ||
      (Boolean(household) && olderAdultsQuery.isPending) ||
      (Boolean(olderAdult) && trustedContactsQuery.isPending),
    isError:
      householdsQuery.isError ||
      olderAdultsQuery.isError ||
      trustedContactsQuery.isError,
    isComplete: Boolean(household && olderAdult && contacts.length > 0),
  };
}
