import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StagedIntentProvider } from "@/app/providers/StagedIntentProvider";
import {
  useStagedCommit,
  useStagedIntent,
  useStagedIntentContext,
} from "@/hooks/useStagedIntent";

const location = vi.hoisted(() => ({ pathname: "/plans/9" }));

vi.mock("@tanstack/react-router", () => ({
  useLocation: () => ({ pathname: location.pathname }),
}));

function PlanPanel({
  planId,
  onCommit,
}: {
  planId: number;
  onCommit: () => void;
}) {
  const staged = useStagedIntent(
    "confirm_plan_status",
    (intent) => intent.planId === planId,
  );
  useStagedCommit(Boolean(staged), onCommit);
  return (
    <p>
      Panel {planId}: {staged ? staged.status : "nothing staged"}
    </p>
  );
}

/** Stands in for the companion tools and for an unrelated re-render. */
function Controls() {
  const { stage, commit } = useStagedIntentContext();
  const [error, setError] = useState("");
  return (
    <>
      <button
        type="button"
        onClick={() =>
          stage(
            {
              kind: "confirm_plan_status",
              planId: 9,
              status: "cancelled" as const,
            },
            "/plans/9",
          )
        }
      >
        stage
      </button>
      <button
        type="button"
        onClick={() => {
          try {
            commit();
            setError("");
          } catch (thrown) {
            setError((thrown as Error).message);
          }
        }}
      >
        confirm
      </button>
      {error ? <p role="alert">{error}</p> : null}
    </>
  );
}

/** Sits above the provider so a route change re-renders it, as the router does. */
function Harness({ onCommit }: { onCommit: () => void }) {
  const [, setTick] = useState(0);
  return (
    <>
      <button
        type="button"
        onClick={() => {
          location.pathname = "/discover";
          setTick((count) => count + 1);
        }}
      >
        navigate away
      </button>
      <StagedIntentProvider>
        <Controls />
        <PlanPanel planId={9} onCommit={onCommit} />
        <PlanPanel planId={10} onCommit={vi.fn()} />
      </StagedIntentProvider>
    </>
  );
}

function renderHarness(onCommit = vi.fn()) {
  render(<Harness onCommit={onCommit} />);
  return onCommit;
}

describe("staged intents", () => {
  beforeEach(() => {
    location.pathname = "/plans/9";
  });

  it("reaches only the panel the intent names", async () => {
    const user = userEvent.setup();
    renderHarness();

    await user.click(screen.getByRole("button", { name: "stage" }));

    expect(screen.getByText("Panel 9: cancelled")).toBeVisible();
    expect(screen.getByText("Panel 10: nothing staged")).toBeVisible();
  });

  it("runs the panel's own handler when confirmed", async () => {
    const user = userEvent.setup();
    const onCommit = renderHarness();

    await user.click(screen.getByRole("button", { name: "stage" }));
    await user.click(screen.getByRole("button", { name: "confirm" }));

    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("refuses to confirm when nothing is staged", async () => {
    const user = userEvent.setup();
    renderHarness();

    await user.click(screen.getByRole("button", { name: "confirm" }));

    expect(screen.getByRole("alert")).toHaveTextContent(
      /nothing waiting to be confirmed/i,
    );
  });

  it("drops the staged action once the person leaves the page", async () => {
    const user = userEvent.setup();
    const onCommit = renderHarness();
    await user.click(screen.getByRole("button", { name: "stage" }));

    await user.click(screen.getByRole("button", { name: "navigate away" }));

    expect(screen.getByText("Panel 9: nothing staged")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "confirm" }));
    expect(screen.getByRole("alert")).toHaveTextContent(
      /nothing waiting to be confirmed/i,
    );
    expect(onCommit).not.toHaveBeenCalled();
  });
});
