import type { ReactNode } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CompanionPanel } from "@/features/companion/CompanionPanel";
import { createVoiceSession } from "@/features/companion/api/voiceApi";
import { StagedIntentContext } from "@/hooks/useStagedIntent";
import { createQueryClient } from "@/lib/queryClient";
import { fetchClient } from "@/lib/fetchClient";
import type { StagedIntent } from "@/types/stagedIntent";

const sdk = vi.hoisted(() => {
  class FakeSession {
    handlers = new Map<string, (...args: unknown[]) => void>();
    options: Record<string, unknown> = {};
    connect = vi.fn().mockResolvedValue(undefined);
    close = vi.fn();
    mute = vi.fn();
    interrupt = vi.fn();
    sendMessage = vi.fn();
    approve = vi.fn().mockResolvedValue(undefined);
    reject = vi.fn().mockResolvedValue(undefined);
    transport = {
      on: vi.fn(),
      sendMessage: vi.fn(),
      sendEvent: vi.fn(),
      updateSessionConfig: vi.fn(),
    };
    on(event: string, handler: (...args: unknown[]) => void) {
      this.handlers.set(event, handler);
    }
    emit(event: string, ...args: unknown[]) {
      this.handlers.get(event)?.(...args);
    }
  }

  return {
    FakeSession,
    agentConfig: undefined as
      undefined | { instructions: string; tools: Array<Record<string, never>> },
    sessions: [] as FakeSession[],
    navigate: vi.fn().mockResolvedValue(undefined),
    workflow: {
      selectedActivity: { databaseId: 27, title: "Senior Yoga" },
      searchActivities: vi.fn(),
      selectActivityById: vi.fn(),
      setIsReviewingPlan: vi.fn(),
    },
    setup: {
      family: { id: 1, name: "Lim Family" },
      olderAdult: {
        id: 2,
        name: "Mary Lim",
        preferred_name: "Mary",
        sharing_mode: "family_approval",
      },
      familyMembers: [
        {
          id: 3,
          name: "Anna",
          email: "anna@example.com",
          relationships: [{ older_adult_id: 2, relationship: "Daughter" }],
        },
        {
          id: 4,
          name: "Ben",
          email: "",
          relationships: [{ older_adult_id: 2, relationship: "Son" }],
        },
      ],
    },
  };
});

vi.mock("@tanstack/react-router", () => ({
  useLocation: () => ({ pathname: "/discover" }),
  useNavigate: () => sdk.navigate,
}));

vi.mock("@/features/activities/activityWorkflowContext", () => ({
  useActivityWorkflow: () => sdk.workflow,
}));

vi.mock("@/features/setup/useSetupProgress", () => ({
  useSetupProgress: () => sdk.setup,
}));

vi.mock("@/features/companion/api/voiceApi", async (importOriginal) => ({
  ...(await importOriginal<
    typeof import("@/features/companion/api/voiceApi")
  >()),
  createVoiceSession: vi.fn(),
}));

vi.mock("@openai/agents", () => ({
  tool: (definition: Record<string, unknown>) => definition,
}));

vi.mock("@openai/agents/realtime", () => ({
  RealtimeAgent: class {
    constructor(config: { instructions: string; tools: [] }) {
      sdk.agentConfig = config;
    }
  },
  RealtimeSession: class extends sdk.FakeSession {
    constructor(_agent: unknown, options: Record<string, unknown>) {
      super();
      this.options = options;
      sdk.sessions.push(this);
    }
  },
}));

const mockedCreateVoiceSession = vi.mocked(createVoiceSession);
const stopTrack = vi.fn();
const getUserMedia = vi.fn();

const intentApi = {
  intent: undefined as StagedIntent | undefined,
  stage: vi.fn(),
  clear: vi.fn(),
  registerCommit: vi.fn(() => () => {}),
  commit: vi.fn(),
};

function Providers({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={createQueryClient()}>
      <StagedIntentContext.Provider value={intentApi}>
        {children}
      </StagedIntentContext.Provider>
    </QueryClientProvider>
  );
}

function renderCompanion() {
  return render(
    <Providers>
      <CompanionPanel />
    </Providers>,
  );
}

/** Opens the panel, which connects the text session straight away. */
async function openCompanion(user: ReturnType<typeof userEvent.setup>) {
  renderCompanion();
  await user.click(screen.getByRole("button", { name: /ask or type/i }));
  await screen.findByText("Ready");
  return sdk.sessions.at(-1)!;
}

function toolsByName() {
  return new Map(
    (sdk.agentConfig?.tools ?? []).map((definition) => [
      (definition as unknown as { name: string }).name,
      definition as unknown as {
        name: string;
        needsApproval?: () => Promise<boolean>;
        execute: (args: unknown) => Promise<{ display: string }>;
      },
    ]),
  );
}

beforeEach(() => {
  sdk.sessions.length = 0;
  sdk.agentConfig = undefined;
  intentApi.intent = undefined;
  getUserMedia.mockResolvedValue({ getTracks: () => [{ stop: stopTrack }] });
  vi.stubGlobal("navigator", { mediaDevices: { getUserMedia } });
  mockedCreateVoiceSession.mockResolvedValue({ client_secret: "ek_test" });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("CompanionPanel", () => {
  it("opens straight into typing without asking for the microphone", async () => {
    const user = userEvent.setup();
    const session = await openCompanion(user);

    expect(getUserMedia).not.toHaveBeenCalled();
    expect(session.options.transport).toBe("websocket");
    expect(session.options.config).toMatchObject({
      outputModalities: ["text"],
      audio: { input: { turnDetection: null } },
    });
    expect(screen.getByLabelText(/type a message/i)).toBeEnabled();
  });

  it("answers a typed message in text only, without changing the session default", async () => {
    const user = userEvent.setup();
    const session = await openCompanion(user);

    await user.type(screen.getByLabelText(/type a message/i), "any tai chi?");
    await user.click(screen.getByRole("button", { name: /send typed message/i }));

    expect(session.sendMessage).not.toHaveBeenCalled();
    expect(session.transport.sendMessage).toHaveBeenCalledWith(
      "any tai chi?",
      {},
      { triggerResponse: false },
    );
    expect(session.transport.sendEvent).toHaveBeenCalledWith({
      type: "response.create",
      response: { output_modalities: ["text"] },
    });
  });

  it("cannot promise speech while the session is text only", async () => {
    const user = userEvent.setup();
    await openCompanion(user);

    expect(screen.getByLabelText(/speak replies/i)).toBeDisabled();
    expect(screen.getByText(/typing stays quiet/i)).toBeVisible();
  });

  it("speaks a typed message in a voice session when asked to always speak", async () => {
    const user = userEvent.setup();
    await openCompanion(user);
    await user.click(screen.getByRole("button", { name: /start voice/i }));
    await screen.findByText("Listening");
    const session = sdk.sessions.at(-1)!;

    await user.selectOptions(screen.getByLabelText(/speak replies/i), "always");
    await user.type(screen.getByLabelText(/type a message/i), "hello");
    await user.click(screen.getByRole("button", { name: /send typed message/i }));

    expect(session.sendMessage).toHaveBeenCalledWith("hello");
    expect(session.transport.sendEvent).not.toHaveBeenCalled();
  });

  it("stops speaking a voice session when speech is turned off", async () => {
    const user = userEvent.setup();
    await openCompanion(user);
    await user.click(screen.getByRole("button", { name: /start voice/i }));
    await screen.findByText("Listening");
    const session = sdk.sessions.at(-1)!;

    await user.selectOptions(screen.getByLabelText(/speak replies/i), "never");

    expect(session.transport.updateSessionConfig).toHaveBeenCalledWith({
      outputModalities: ["text"],
    });
  });

  it("upgrades to a spoken session only when voice is started", async () => {
    const user = userEvent.setup();
    const textSession = await openCompanion(user);
    textSession.emit("history_updated", [
      {
        type: "message",
        role: "user",
        itemId: "a",
        content: [{ type: "input_text", text: "find yoga" }],
      },
    ]);

    await user.click(screen.getByRole("button", { name: /start voice/i }));
    await screen.findByText("Listening");

    expect(getUserMedia).toHaveBeenCalledWith({ audio: true });
    expect(stopTrack).toHaveBeenCalled();
    const voiceSession = sdk.sessions.at(-1)!;
    expect(voiceSession.options.transport).toBe("webrtc");
    expect(voiceSession.options.config).toMatchObject({
      outputModalities: ["audio"],
    });
    // The earlier typed conversation is handed over rather than forgotten.
    expect(voiceSession.transport.sendMessage).toHaveBeenCalledWith(
      expect.stringContaining("find yoga"),
      {},
      { triggerResponse: false },
    );
    expect(screen.getByRole("button", { name: /end voice/i })).toBeVisible();
  });

  it("keeps working when the microphone is refused", async () => {
    const user = userEvent.setup();
    await openCompanion(user);
    getUserMedia.mockRejectedValueOnce(
      new DOMException("denied", "NotAllowedError"),
    );

    await user.click(screen.getByRole("button", { name: /start voice/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /you can still type/i,
    );
  });
});

describe("companion tools", () => {
  it("shows activities on the discovery page", async () => {
    const user = userEvent.setup();
    await openCompanion(user);
    vi.spyOn(fetchClient, "GET").mockResolvedValue({
      data: {
        activities: [
          {
            id: 27,
            dedupe_key: "yoga",
            name: "Senior Yoga",
            location: "Bishan CC",
            start_at: "2030-06-01T09:00:00Z",
            currency: "SGD",
            cost: 0,
            tags: [],
            status: "active",
            info_link: "https://example.com",
            first_seen_at: "2029-12-01T00:00:00Z",
            last_seen_at: "2029-12-01T00:00:00Z",
          },
        ],
      },
      response: new Response(null, { status: 200 }),
    } as never);

    const result = await toolsByName()
      .get("find_activities")!
      .execute({ location: "Bishan", limit: 3 });

    expect(sdk.navigate).toHaveBeenCalledWith({ to: "/discover" });
    expect(sdk.workflow.searchActivities).toHaveBeenCalledWith("Bishan", 3);
    expect(result.display).toMatch(/discovery page lists 1 activity near Bishan/i);
  });



  it("presses the button the person can see when confirming", async () => {
    const user = userEvent.setup();
    await openCompanion(user);
    intentApi.intent = {
      id: "intent-1",
      path: "/discover",
      kind: "review_plan",
    };

    const result = await toolsByName().get("confirm_staged_action")!.execute({});

    expect(intentApi.commit).toHaveBeenCalledTimes(1);
    expect(result.display).toMatch(/confirmation was pressed/i);
  });

  it("explains itself when there is nothing on screen to confirm", async () => {
    const user = userEvent.setup();
    await openCompanion(user);

    await expect(
      toolsByName().get("confirm_staged_action")!.execute({}),
    ).rejects.toThrow(/nothing waiting to be confirmed/i);
    expect(intentApi.commit).not.toHaveBeenCalled();
  });

  it("asks for approval only before emailing people outside the app", async () => {
    const user = userEvent.setup();
    await openCompanion(user);
    const confirm = toolsByName().get("confirm_staged_action")!;

    intentApi.intent = { id: "a", path: "/discover", kind: "review_plan" };
    await expect(confirm.needsApproval!()).resolves.toBe(false);

    intentApi.intent = {
      id: "b",
      path: "/plans/12",
      kind: "confirm_plan_status",
      planId: 12,
      status: "cancelled",
    };
    await expect(confirm.needsApproval!()).resolves.toBe(true);
  });

  it("never offers a tool that mutates on its own", async () => {
    const user = userEvent.setup();
    await openCompanion(user);

    const names = [...toolsByName().keys()];
    expect(names).not.toContain("create_plan");
    expect(names).not.toContain("send_plan_notifications");
    expect(names).not.toContain("offer_support");
    expect(names).toEqual(
      expect.arrayContaining([
        "open_page",
        "find_activities",
        "list_family_members",
        "list_plans",
        "review_plan",
        "stage_plan_status",
                        "confirm_staged_action",
        "cancel_staged_action",
      ]),
    );
  });

  it("tells the model that the screen carries the detail", async () => {
    const user = userEvent.setup();
    await openCompanion(user);

    expect(sdk.agentConfig?.instructions).toMatch(/Mary/);
    expect(sdk.agentConfig?.instructions).toMatch(/Never read a list aloud/i);
    expect(sdk.agentConfig?.instructions).toMatch(
      /only call confirm_staged_action immediately after/i,
    );
  });
});

it("waits for the person before confirming an email", async () => {
  const user = userEvent.setup();
  const session = await openCompanion(user);

  session.emit(
    "tool_approval_requested",
    {},
    {},
    {
      type: "function_approval",
      approvalItem: { name: "confirm_staged_action" },
      tool: { name: "confirm_staged_action" },
    },
  );
  intentApi.intent = {
    id: "b",
    path: "/plans/12",
    kind: "confirm_plan_status",
    planId: 12,
      status: "cancelled",
  };

  await user.click(await screen.findByRole("button", { name: /approve action/i }));

  await waitFor(() => expect(session.approve).toHaveBeenCalled());
});
