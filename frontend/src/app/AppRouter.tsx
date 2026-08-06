import { RouterProvider } from "@tanstack/react-router";
import { router } from "@/app/router";
import { useAuthSession } from "@/features/auth/AuthSessionContext";

export function AppRouter() {
  const auth = useAuthSession();

  if (auth.isLoading) {
    return (
      <main className="grid h-dvh place-items-center bg-background px-6 text-center text-foreground">
        <p className="text-lg font-bold" role="status">
          Checking your account…
        </p>
      </main>
    );
  }

  return <RouterProvider router={router} context={{ auth }} />;
}
