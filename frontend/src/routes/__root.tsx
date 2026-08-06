import { Outlet, createRootRouteWithContext } from "@tanstack/react-router";
import type { AuthSessionContextValue } from "@/features/auth/AuthSessionContext";

export interface AppRouterContext {
  auth: AuthSessionContextValue;
}

export const Route = createRootRouteWithContext<AppRouterContext>()({
  component: Outlet,
});
