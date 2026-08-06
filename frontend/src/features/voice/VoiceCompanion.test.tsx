import { QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { planQueryKey } from "@/features/plans/api/planQueries";
import { VoiceCompanion } from "@/features/voice/VoiceCompanion";
import {
  createVoiceSession,
  VoiceSessionError,
} from "@/features/voice/api/voiceApi";
import { createQueryClient } from "@/lib/queryClient";

const sdk = vi.hoisted(() => {
  class FakeSession {
    handlers = new Map<string, (...args: unknown[]) => void>();
    transportHandler?: (status: string) => void;
    connect = vi.fn().mockResolvedValue(undefined);
    close = vi.fn();
    mute = vi.fn();
    interrupt = vi.fn();
    sendMessage = vi.fn();
    approve = vi.fn().mockResolvedValue(undefined);
    reject = vi.fn().mockResolvedValue(undefined);
    transport = {
      on: vi.fn((_event: string, handler: (status: string) => void) => {
        this.transportHandler = handler;
      }),
    };
    on(event: string, handler: (...args: unknown[]) => void) {
      this.handlers.set(event, handler);
    }
    emit(event: string, ...args: unknown[]) {
      this.handlers.get(event)?.(...args);
    }
  }

  return {
    agentConfig: undefined as
      undefined | { tools: Array<Record<string, unknown>> },
    sessions: [] as FakeSession[],
    FakeSession,
    navigate: vi.fn(),
    workflow: {
      selectedActivity: {
        databaseId: 27,
        title: "Senior Yoga",
      },
      searchActivities: vi.fn(),
      selectActivityById: vi.fn(),
    },
    setup: {
      household: { id: 1, name: "Lim Family" },
      olderAdult: {
        id: 2,
        name: "Mary Lim",
        preferred_name: "Mary",
        sharing_mode: "family_approval",
      },
      contacts: [
        { id: 3, name: "Anna", email: "anna@example.com" },
        { id: 4, name: "Ben", email: null },
      ],
    },
  };
});

vi.mock("@tanstack/react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-router")>()),
  useLocation: () => ({ pathname: "/discover" }),
  useNavigate: () => sdk.navigate,
}));

vi.mock("@/features/activities/activityWorkflowContext", () => ({
  useActivityWorkflow: () => sdk.workflow,
}));

vi.mock("@/features/setup/useSetupProgress", () => ({
  useSetupProgress: () => sdk.setup,
}));

vi.mock("@/features/voice/api/voiceApi", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/features/voice/api/voiceApi")>()),
  createVoiceSession: vi.fn(),
}));

vi.mock("@openai/agents", () => ({
  tool: (definition: Record<string, unknown>) => definition,
}));

vi.mock("@openai/agents/realtime", () => ({
  RealtimeAgent: class {
    constructor(config: { tools: Array<Record<string, unknown>> }) {
      sdk.agentConfig = config;
    }
  },
  RealtimeSession: class extends sdk.FakeSession {
    constructor() {
      super();
      sdk.sessions.push(this);
    }
  },
}));

const mockedCreateVoiceSession = vi.mocked(createVoiceSession);
const stopTrack = vi.fn();

function renderCompanion() {
  const queryClient = createQueryClient();
  const view = render(
    <QueryClientProvider client={queryClient}>
      <div>Visible click workflow</div>
      <VoiceCompanion />
    </QueryClientProvider>,
  );
  return { ...view, queryClient };
}

async function connectVoice() {
  const user = userEvent.setup();
  const { queryClient } = renderCompanion();
  await user.click(screen.getByRole("button", { name: /voice companion/i }));
  await user.click(screen.getByRole("button", { name: /start voice/i }));
  await screen.findByText("Listening");
  return { user, session: sdk.sessions.at(-1)!, queryClient };
}

describe("VoiceCompanion", () => {
  beforeEach(() => {
    sdk.sessions.length = 0;
    sdk.agentConfig = undefined;
    sdk.navigate.mockReset();
    sdk.workflow.searchActivities.mockReset();
    sdk.workflow.selectActivityById.mockReset();
    stopTrack.mockReset();
    mockedCreateVoiceSession.mockReset().mockResolvedValue({
      client_secret: "ek_test",
      expires_at: 123,
      session: { id: "sess_test" },
    });
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: vi.fn().mockResolvedValue({
          getTracks: () => [{ stop: stopTrack }],
        }),
      },
    });
  });

  it("waits for an explicit click before requesting microphone or credentials", async () => {
    const user = userEvent.setup();
    renderCompanion();

    expect(mockedCreateVoiceSession).not.toHaveBeenCalled();
    expect(navigator.mediaDevices.getUserMedia).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: /voice companion/i }));
    expect(screen.getByText(/nothing begins automatically/i)).toBeVisible();
    expect(mockedCreateVoiceSession).not.toHaveBeenCalled();
  });

  it("connects with the short-lived credential and exposes session controls", async () => {
    const { user, session } = await connectVoice();

    expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({
      audio: true,
    });
    expect(stopTrack).toHaveBeenCalledOnce();
    expect(session.connect).toHaveBeenCalledWith({ apiKey: "ek_test" });

    await user.click(screen.getByRole("button", { name: "Mute" }));
    expect(session.mute).toHaveBeenCalledWith(true);
    await user.click(screen.getByRole("button", { name: /stop speech/i }));
    expect(session.interrupt).toHaveBeenCalledOnce();
    await user.type(screen.getByLabelText(/type a message/i), "Hello");
    await user.click(
      screen.getByRole("button", { name: /send typed message/i }),
    );
    expect(session.sendMessage).toHaveBeenCalledWith("Hello");
  });

  it("reflects realtime lifecycle and transcript events", async () => {
    const { session } = await connectVoice();

    act(() => session.emit("agent_start"));
    expect(screen.getByText("Thinking")).toBeVisible();
    act(() => session.emit("audio_start"));
    expect(screen.getByText("Speaking")).toBeVisible();
    act(() =>
      session.emit("history_updated", [
        {
          type: "message",
          role: "user",
          itemId: "user-1",
          content: [{ type: "input_text", text: "Find yoga" }],
        },
        {
          type: "message",
          role: "assistant",
          itemId: "assistant-1",
          content: [{ type: "output_text", text: "I found Senior Yoga" }],
        },
      ]),
    );
    expect(screen.getByText("Find yoga")).toBeVisible();
    expect(screen.getByText("I found Senior Yoga")).toBeVisible();

    act(() => session.transportHandler?.("disconnected"));
    expect(screen.getByText("Voice ended")).toBeVisible();
  });

  it("requires a fresh human decision for a consequential tool call", async () => {
    const { user, session } = await connectVoice();
    const approvalItem = {
      type: "function_call",
      name: "send_plan_notifications",
      arguments: JSON.stringify({ planId: 5, contactIds: [3] }),
    };

    act(() =>
      session.emit(
        "tool_approval_requested",
        {},
        {},
        {
          type: "function_approval",
          approvalItem,
          tool: { name: "send_plan_notifications" },
        },
      ),
    );

    expect(screen.getByText(/email plan 5 to anna/i)).toBeVisible();
    expect(
      screen.getByText(/nothing happens until you approve/i),
    ).toBeVisible();
    expect(screen.getByLabelText(/type a message/i)).toBeDisabled();

    await user.click(screen.getByRole("button", { name: /approve action/i }));
    await waitFor(() =>
      expect(session.approve).toHaveBeenCalledWith(approvalItem),
    );
    expect(session.reject).not.toHaveBeenCalled();
  });

  it("rejects an approval without making it sticky", async () => {
    const { user, session } = await connectVoice();
    const approvalItem = {
      type: "function_call",
      name: "offer_support",
      arguments: "not-json",
    };
    act(() =>
      session.emit(
        "tool_approval_requested",
        {},
        {},
        {
          type: "function_approval",
          approvalItem,
          tool: { name: "offer_support" },
        },
      ),
    );

    expect(
      screen.getByText(/offer undefined for plan undefined/i),
    ).toBeVisible();
    await user.click(screen.getByRole("button", { name: /reject action/i }));
    await waitFor(() => expect(session.reject).toHaveBeenCalledOnce());
    expect(screen.queryByText(/confirm this action/i)).not.toBeInTheDocument();
  });

  it("marks only mutating tools as approval-gated and guards visible selection", async () => {
    const { queryClient } = await connectVoice();
    const tools = sdk.agentConfig!.tools;
    const byName = (name: string) => tools.find((tool) => tool.name === name)!;

    expect(byName("find_activities").needsApproval).toBeUndefined();
    expect(byName("select_activity").needsApproval).toBeUndefined();
    for (const name of [
      "create_plan",
      "request_plan_approval",
      "share_plan",
      "send_plan_notifications",
      "offer_support",
    ]) {
      expect(byName(name).needsApproval).toBe(true);
    }

    sdk.workflow.selectActivityById.mockReturnValueOnce(undefined);
    const select = byName("select_activity").execute as (input: {
      activityId: number;
    }) => Promise<unknown>;
    await expect(select({ activityId: 999 })).rejects.toThrow(
      /not in the visible results/i,
    );

    const draftPlan = {
      id: 5,
      household_id: 1,
      older_adult_id: 2,
      activity_id: 27,
      status: "draft",
      created_by: "user-1",
      created_at: "2030-01-01T00:00:00Z",
      updated_at: "2030-01-01T00:00:00Z",
    };
    queryClient.setQueryData(planQueryKey(5), draftPlan);
    const share = byName("share_plan").execute as (input: {
      planId: number;
    }) => Promise<unknown>;
    await expect(share({ planId: 5 })).rejects.toThrow(/waiting for approval/i);
    const notify = byName("send_plan_notifications").execute as (input: {
      planId: number;
      contactIds: number[];
    }) => Promise<unknown>;
    await expect(notify({ planId: 5, contactIds: [3] })).rejects.toThrow(
      /only shared plans/i,
    );
    queryClient.setQueryData(planQueryKey(5), {
      ...draftPlan,
      status: "shared",
    });
    await expect(notify({ planId: 5, contactIds: [4] })).rejects.toThrow(
      /no email address/i,
    );
    const support = byName("offer_support").execute as (input: {
      planId: number;
      supportType: "join";
    }) => Promise<unknown>;
    await expect(support({ planId: 5, supportType: "join" })).rejects.toThrow(
      /family view/i,
    );
  });

  it("keeps the click workflow available when microphone permission fails", async () => {
    const denied = new DOMException("Denied", "NotAllowedError");
    vi.mocked(navigator.mediaDevices.getUserMedia).mockRejectedValueOnce(
      denied,
    );
    const user = userEvent.setup();
    renderCompanion();
    await user.click(screen.getByRole("button", { name: /voice companion/i }));
    await user.click(screen.getByRole("button", { name: /start voice/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /microphone access was denied/i,
    );
    expect(screen.getByText("Visible click workflow")).toBeVisible();
    expect(screen.getByRole("button", { name: /start voice/i })).toBeEnabled();
    expect(mockedCreateVoiceSession).not.toHaveBeenCalled();
  });

  it("explains expired authentication and allows a retry", async () => {
    mockedCreateVoiceSession.mockRejectedValueOnce(
      new VoiceSessionError("Unauthorized", 401),
    );
    const user = userEvent.setup();
    renderCompanion();
    await user.click(screen.getByRole("button", { name: /voice companion/i }));
    await user.click(screen.getByRole("button", { name: /start voice/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /login session has expired/i,
    );
    expect(screen.getByRole("button", { name: /start voice/i })).toBeEnabled();
  });

  it("closes the session after an SDK failure and on unmount", async () => {
    const first = await connectVoice();
    act(() => first.session.emit("error", new Error("transport failed")));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      /visible controls/i,
    );
    expect(first.session.close).toHaveBeenCalledOnce();

    const secondView = renderCompanion();
    const user = userEvent.setup();
    await user.click(
      screen.getAllByRole("button", { name: /voice companion/i }).at(-1)!,
    );
    await user.click(
      screen.getAllByRole("button", { name: /start voice/i }).at(-1)!,
    );
    await waitFor(() => expect(sdk.sessions).toHaveLength(2));
    const second = sdk.sessions[1];
    secondView.unmount();
    expect(second.close).toHaveBeenCalledOnce();
  });
});
