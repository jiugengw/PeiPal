import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { signOut } from "@/features/auth/signOut";

export function LogoutButton() {
  const navigate = useNavigate();
  const mutation = useMutation({
    mutationFn: signOut,
    onSuccess: () => {
      void navigate({
        to: "/auth",
        search: { redirect: undefined },
        replace: true,
      });
    },
  });

  return (
    <div className="relative">
      <button
        className="inline-flex min-h-11 cursor-pointer items-center rounded-xl border border-primary bg-background px-4 font-extrabold text-primary hover:bg-muted disabled:cursor-wait disabled:opacity-60"
        type="button"
        disabled={mutation.isPending}
        onClick={() => mutation.mutate()}
      >
        {mutation.isPending ? "Logging out…" : "Log out"}
      </button>
      {mutation.isError ? (
        <span
          className="absolute top-[calc(100%+8px)] right-0 z-10 w-48 rounded-xl bg-muted p-3 text-sm font-bold text-foreground shadow-[0_8px_24px_rgb(37_44_64_/_0.14)]"
          role="alert"
        >
          Could not log out. Try again.
        </span>
      ) : null}
    </div>
  );
}
