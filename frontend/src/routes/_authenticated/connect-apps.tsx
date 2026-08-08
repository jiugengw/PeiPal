import { createFileRoute } from "@tanstack/react-router";
import { ConnectApps } from "@/features/workbuddy/ConnectApps";

export const Route = createFileRoute("/_authenticated/connect-apps")({
  component: ConnectApps,
});
