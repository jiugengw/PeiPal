import { createFileRoute, redirect } from "@tanstack/react-router";
import { App } from "@/app/App";

export const Route = createFileRoute("/_authenticated")({
  beforeLoad: ({ context, location }) => {
    if (context.auth.session) return;

    throw redirect({
      to: "/auth",
      search: { redirect: location.href },
      replace: true,
    });
  },
  component: App,
});
