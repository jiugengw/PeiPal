import { apiQueryOptions } from "@/lib/fetchClient";

export const familiesQueryOptions = () =>
  apiQueryOptions("get", "/api/families");

export const olderAdultsQueryOptions = (familyId: number) =>
  apiQueryOptions("get", "/api/families/{family_id}/older-adults", {
    params: { path: { family_id: familyId } },
  });

export const familyMembersQueryOptions = (familyId: number) =>
  apiQueryOptions("get", "/api/families/{family_id}/family-members", {
    params: { path: { family_id: familyId } },
  });
