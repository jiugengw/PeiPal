import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TaskCard } from "@/features/coordination/TaskCard";
import type { CoordinationTask } from "@/features/coordination/api/coordinationQueries";

function task(overrides: Partial<CoordinationTask> = {}): CoordinationTask {
  return {
    task_type: "registration",
    status: "open",
    owner_name: null,
    decided_by_name: null,
    reason: null,
    version: 1,
    ...overrides,
  };
}

function renderCard(overrides: Partial<Parameters<typeof TaskCard>[0]> = {}) {
  return render(
    <TaskCard
      isApproved={false}
      isBusy={false}
      isSettled={false}
      onAct={vi.fn()}
      task={task()}
      {...overrides}
    />,
  );
}

describe("TaskCard", () => {
  it.each(["registration", "transport"] as const)(
    "blocks claiming a %s task until the plan is approved",
    (taskType) => {
      renderCard({ isApproved: false, task: task({ task_type: taskType }) });

      expect(
        screen.getByText(/waiting for the family to approve/i),
      ).toBeVisible();
      expect(
        screen.queryByRole("button", { name: /i can do this/i }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: /not needed/i }),
      ).not.toBeInTheDocument();
    },
  );

  it("allows claiming a transport task once the plan is approved", async () => {
    const onAct = vi.fn();
    const user = userEvent.setup();
    renderCard({
      isApproved: true,
      onAct,
      task: task({ task_type: "transport" }),
    });

    expect(
      screen.queryByText(/waiting for the family to approve/i),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /i can do this/i }));

    expect(onAct).toHaveBeenCalledWith("claim");
  });

  it("signing up an unclaimed registration task goes straight to done, with no offer step", async () => {
    const onAct = vi.fn();
    const user = userEvent.setup();
    renderCard({
      isApproved: true,
      onAct,
      task: task({ task_type: "registration" }),
    });

    expect(
      screen.queryByText(/waiting for the family to approve/i),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /i can do this/i }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /i have done this/i }));

    expect(onAct).toHaveBeenCalledWith("sign_up_done");
  });

  it("lets someone give up a role they claimed, via the Cancel role button", async () => {
    const onAct = vi.fn();
    const user = userEvent.setup();
    renderCard({
      isApproved: true,
      onAct,
      respondingAs: "Anna",
      task: task({ status: "claimed", owner_name: "Anna" }),
    });

    expect(screen.queryByRole("button", { name: /step back/i })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /cancel role/i }));

    expect(onAct).toHaveBeenCalledWith("release");
  });

  it("never blocks the approval task itself, regardless of isApproved", () => {
    renderCard({ isApproved: false, task: task({ task_type: "approval" }) });

    expect(screen.getByRole("button", { name: /yes, approve/i })).toBeVisible();
    expect(
      screen.queryByText(/waiting for the family to approve/i),
    ).not.toBeInTheDocument();
  });

  it("still hides everything once the task itself is resolved, regardless of isApproved", () => {
    renderCard({
      isApproved: false,
      task: task({ task_type: "registration", status: "done", owner_name: "Anna" }),
    });

    expect(
      screen.queryByText(/waiting for the family to approve/i),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /i can do this/i }),
    ).not.toBeInTheDocument();
  });
});
