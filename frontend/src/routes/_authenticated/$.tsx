import { Link, createFileRoute } from "@tanstack/react-router";
import { PageIntro } from "@/components/PageIntro";

export const Route = createFileRoute("/_authenticated/$")({
  component: NotFoundPage,
});

function NotFoundPage() {
  return (
    <PageIntro
      title="We could not find that page."
      description="The address may have changed, or the page may not exist yet."
    >
      <Link
        className="inline-flex min-h-14 items-center rounded-md bg-primary px-6 font-bold text-primary-foreground hover:bg-foreground"
        to="/"
      >
        Return home
      </Link>
    </PageIntro>
  );
}
