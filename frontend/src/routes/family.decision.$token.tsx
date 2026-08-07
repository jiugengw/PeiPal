import { createFileRoute } from "@tanstack/react-router";
import { DecisionPage } from "@/features/decisions/DecisionPage";

/**
 * Public on purpose. Family members are reached by email and may not hold an
 * account, so the signed token in the link is what authorises the decision.
 */
export const Route = createFileRoute("/family/decision/$token")({
  component: DecisionRoute,
});

function DecisionRoute() {
  const { token } = Route.useParams();
  return <DecisionPage token={token} />;
}
