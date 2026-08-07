import { createFileRoute } from "@tanstack/react-router";
import { CoordinationPage } from "@/features/coordination/CoordinationPage";

/**
 * Public on purpose. Family members are reached by email and hold no account,
 * so the token in the link is what authorises them.
 */
export const Route = createFileRoute("/coordinate/$token")({
  component: CoordinateRoute,
});

function CoordinateRoute() {
  const { token } = Route.useParams();
  return <CoordinationPage token={token} />;
}
