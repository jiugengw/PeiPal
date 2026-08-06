import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type MutableRefObject,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation, useNavigate } from "@tanstack/react-router";
import { Mic, MicOff, Pause, Send, Square, X } from "lucide-react";
import type { RunToolApprovalItem } from "@openai/agents";
import type { RealtimeItem, RealtimeSession } from "@openai/agents/realtime";
import { z } from "zod";
import { activitiesQueryOptions } from "@/features/activities/api/activityQueries";
import { toActivity } from "@/features/activities/api/toActivity";
import { useActivityWorkflow } from "@/features/activities/activityWorkflowContext";
import {
  createSupportOffer,
  supportOffersQueryKey,
} from "@/features/family/api/supportQueries";
import { supportTypeLabels } from "@/features/family/supportTypes";
import {
  notificationsQueryKey,
  sendPlanNotifications,
} from "@/features/notifications/api/notificationQueries";
import {
  createPlan,
  planQueryKey,
  planQueryOptions,
  plansQueryKey,
  updatePlanStatus,
} from "@/features/plans/api/planQueries";
import { useSetupProgress } from "@/features/setup/useSetupProgress";
import {
  createVoiceSession,
  VoiceSessionError,
} from "@/features/voice/api/voiceApi";

type VoiceState =
  | "idle"
  | "requesting_microphone"
  | "connecting"
  | "listening"
  | "thinking"
  | "speaking"
  | "approval"
  | "disconnected"
  | "error";

interface TranscriptLine {
  id: string;
  role: "You" | "Companion";
  text: string;
}

interface PendingApproval {
  item: RunToolApprovalItem;
  toolName: string;
  arguments: Record<string, unknown>;
}

export function VoiceCompanion() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const workflow = useActivityWorkflow();
  const setup = useSetupProgress();
  const sessionRef = useRef<RealtimeSession | null>(null);
  const workflowRef = useRef(workflow);
  const setupRef = useRef(setup);
  const locationRef = useRef(location.pathname);

  const [isOpen, setIsOpen] = useState(false);
  const [voiceState, setVoiceState] = useState<VoiceState>("idle");
  const [isMuted, setIsMuted] = useState(false);
  const [transcript, setTranscript] = useState<TranscriptLine[]>([]);
  const [typedMessage, setTypedMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [pendingApproval, setPendingApproval] = useState<PendingApproval>();

  useEffect(() => () => sessionRef.current?.close(), []);
  useEffect(() => {
    workflowRef.current = workflow;
  }, [workflow]);
  useEffect(() => {
    setupRef.current = setup;
  }, [setup]);
  useEffect(() => {
    locationRef.current = location.pathname;
  }, [location.pathname]);

  async function startVoice() {
    setIsOpen(true);
    setErrorMessage("");
    setTranscript([]);
    try {
      if (!navigator.mediaDevices?.getUserMedia)
        throw new Error("This browser does not provide microphone access.");
      setVoiceState("requesting_microphone");
      const permissionStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });
      permissionStream.getTracks().forEach((track) => track.stop());

      setVoiceState("connecting");
      const [credential, agents, realtime] = await Promise.all([
        createVoiceSession(),
        import("@openai/agents"),
        import("@openai/agents/realtime"),
      ]);
      const { RealtimeAgent, RealtimeSession } = realtime;
      const agent = new RealtimeAgent({
        name: "Count Me In companion",
        instructions: agentInstructions(setupRef.current.olderAdult),
        tools: createTools({
          toolFactory: agents.tool,
          queryClient,
          navigate,
          workflowRef,
          setupRef,
          locationRef,
        }),
      });
      const session = new RealtimeSession(agent, {
        model: "gpt-realtime-2.1",
        transport: "webrtc",
        toolExecution: { preApprovalInputGuardrails: true },
        workflowName: "Count Me In browser voice",
      });
      sessionRef.current = session;
      session.on("history_updated", (history) =>
        setTranscript(transcriptFromHistory(history)),
      );
      session.on("agent_start", () => setVoiceState("thinking"));
      session.on("agent_end", () => setVoiceState("listening"));
      session.on("audio_start", () => setVoiceState("speaking"));
      session.on("audio_stopped", () => setVoiceState("listening"));
      session.on("audio_interrupted", () => setVoiceState("listening"));
      session.on("tool_approval_requested", (_context, _agent, request) => {
        if (request.type !== "function_approval") return;
        setPendingApproval(approvalDetails(request));
        setVoiceState("approval");
      });
      session.on("error", () =>
        failVoice(
          "The voice connection ran into a problem. You can continue with the visible controls.",
        ),
      );
      session.transport.on("connection_change", (status) => {
        if (status === "disconnected" && sessionRef.current === session)
          setVoiceState("disconnected");
      });
      await session.connect({ apiKey: credential.client_secret });
      setVoiceState("listening");
    } catch (error) {
      const message =
        error instanceof VoiceSessionError && error.status === 401
          ? "Your login session has expired. Log in again, then start voice."
          : error instanceof DOMException && error.name === "NotAllowedError"
            ? "Microphone access was denied. You can still use every button and form."
            : error instanceof Error
              ? error.message
              : "Voice is not available right now.";
      failVoice(message);
    }
  }

  function failVoice(message: string) {
    sessionRef.current?.close();
    sessionRef.current = null;
    setErrorMessage(message);
    setPendingApproval(undefined);
    setVoiceState("error");
  }

  function endVoice() {
    sessionRef.current?.close();
    sessionRef.current = null;
    setPendingApproval(undefined);
    setIsMuted(false);
    setVoiceState("disconnected");
  }

  function toggleMute() {
    const session = sessionRef.current;
    if (!session) return;
    const nextMuted = !isMuted;
    session.mute(nextMuted);
    setIsMuted(nextMuted);
  }

  function submitTypedMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const message = typedMessage.trim();
    if (!message || !sessionRef.current || pendingApproval) return;
    sessionRef.current.sendMessage(message);
    setTypedMessage("");
  }

  async function resolveApproval(approved: boolean) {
    const session = sessionRef.current;
    if (!session || !pendingApproval) return;
    const approval = pendingApproval;
    setPendingApproval(undefined);
    setVoiceState("thinking");
    if (approved) await session.approve(approval.item);
    else
      await session.reject(approval.item, {
        message:
          "The user chose not to perform that action. Offer the equivalent visible control if helpful.",
      });
  }

  const isConnected = [
    "listening",
    "thinking",
    "speaking",
    "approval",
  ].includes(voiceState);
  return (
    <aside
      className="fixed right-4 bottom-4 z-40 w-[calc(100%-2rem)] max-w-[390px]"
      aria-label="Voice companion"
    >
      {!isOpen ? (
        <button
          className="ml-auto flex min-h-14 items-center gap-3 rounded-xl bg-primary px-5 font-bold text-primary-foreground shadow-[0_14px_34px_rgb(37_44_64_/_0.22)] hover:bg-foreground"
          onClick={() => setIsOpen(true)}
          type="button"
        >
          <Mic aria-hidden="true" size={22} /> Voice companion
        </button>
      ) : (
        <div className="rounded-2xl bg-background p-5 shadow-[0_22px_55px_rgb(37_44_64_/_0.22)]">
          <div className="flex items-start justify-between gap-4 border-b border-border pb-4">
            <div>
              <h2 className="text-xl font-bold text-foreground">
                Voice companion
              </h2>
              <p className="mt-1 text-base text-foreground" aria-live="polite">
                {voiceStatus(voiceState, isMuted)}
              </p>
            </div>
            <button
              className="grid min-h-12 min-w-12 place-items-center rounded-xl text-foreground hover:bg-muted"
              onClick={() => {
                if (isConnected) endVoice();
                setIsOpen(false);
              }}
              type="button"
              aria-label="Close voice companion"
            >
              <X aria-hidden="true" />
            </button>
          </div>

          {transcript.length > 0 ? (
            <div
              className="max-h-56 overflow-y-auto border-b border-border py-4"
              aria-live="polite"
            >
              {transcript.slice(-6).map((line) => (
                <p
                  className="mb-3 text-base leading-relaxed text-foreground last:mb-0"
                  key={line.id}
                >
                  <strong>{line.role}:</strong> {line.text}
                </p>
              ))}
            </div>
          ) : (
            <p className="border-b border-border py-4 text-base leading-relaxed text-foreground">
              Start voice when you are ready. Nothing begins automatically.
            </p>
          )}

          {pendingApproval ? (
            <ApprovalPanel
              approval={pendingApproval}
              activityTitle={workflow.selectedActivity?.title}
              contactNames={setup.contacts
                .filter(
                  (contact) =>
                    Array.isArray(pendingApproval.arguments.contactIds) &&
                    pendingApproval.arguments.contactIds.includes(contact.id),
                )
                .map((contact) => contact.name)}
              disabled={voiceState !== "approval"}
              onDecision={(value) => void resolveApproval(value)}
            />
          ) : null}
          {errorMessage ? (
            <p
              className="mt-4 rounded-xl bg-muted p-4 font-bold text-foreground"
              role="alert"
            >
              {errorMessage}
            </p>
          ) : null}

          {!isConnected ? (
            <button
              className="mt-4 flex min-h-14 w-full items-center justify-center gap-3 rounded-xl bg-primary px-5 font-bold text-primary-foreground hover:bg-foreground disabled:opacity-60"
              disabled={
                voiceState === "requesting_microphone" ||
                voiceState === "connecting"
              }
              onClick={() => void startVoice()}
              type="button"
            >
              <Mic aria-hidden="true" />
              {voiceState === "requesting_microphone"
                ? "Waiting for microphone…"
                : voiceState === "connecting"
                  ? "Connecting…"
                  : "Start voice"}
            </button>
          ) : (
            <>
              <div className="mt-4 grid grid-cols-3 gap-2">
                <button
                  className="flex min-h-14 flex-col items-center justify-center rounded-xl border border-input bg-background px-2 text-sm font-bold text-foreground hover:bg-muted"
                  onClick={toggleMute}
                  type="button"
                >
                  {isMuted ? (
                    <Mic aria-hidden="true" size={20} />
                  ) : (
                    <MicOff aria-hidden="true" size={20} />
                  )}
                  {isMuted ? "Unmute" : "Mute"}
                </button>
                <button
                  className="flex min-h-14 flex-col items-center justify-center rounded-xl border border-input bg-background px-2 text-sm font-bold text-foreground hover:bg-muted"
                  onClick={() => sessionRef.current?.interrupt()}
                  type="button"
                >
                  <Pause aria-hidden="true" size={20} />
                  Stop speech
                </button>
                <button
                  className="flex min-h-14 flex-col items-center justify-center rounded-xl border border-input bg-background px-2 text-sm font-bold text-foreground hover:bg-muted"
                  onClick={endVoice}
                  type="button"
                >
                  <Square aria-hidden="true" size={18} />
                  End voice
                </button>
              </div>
              <form className="mt-3 flex gap-2" onSubmit={submitTypedMessage}>
                <label className="sr-only" htmlFor="voice-message">
                  Type a message
                </label>
                <input
                  className="min-h-14 min-w-0 flex-1 rounded-xl border border-input bg-background px-4 text-base text-foreground"
                  id="voice-message"
                  value={typedMessage}
                  onChange={(event) => setTypedMessage(event.target.value)}
                  disabled={Boolean(pendingApproval)}
                  placeholder="Type instead…"
                />
                <button
                  className="grid min-h-14 min-w-14 place-items-center rounded-xl bg-primary text-primary-foreground disabled:opacity-50"
                  disabled={!typedMessage.trim() || Boolean(pendingApproval)}
                  type="submit"
                  aria-label="Send typed message"
                >
                  <Send aria-hidden="true" size={20} />
                </button>
              </form>
            </>
          )}
        </div>
      )}
    </aside>
  );
}

function createTools({
  toolFactory,
  queryClient,
  navigate,
  workflowRef,
  setupRef,
  locationRef,
}: {
  toolFactory: (typeof import("@openai/agents"))["tool"];
  queryClient: ReturnType<typeof useQueryClient>;
  navigate: ReturnType<typeof useNavigate>;
  workflowRef: MutableRefObject<ReturnType<typeof useActivityWorkflow>>;
  setupRef: MutableRefObject<ReturnType<typeof useSetupProgress>>;
  locationRef: MutableRefObject<string>;
}) {
  const planIdSchema = z.object({ planId: z.number().int().positive() });
  return [
    toolFactory({
      name: "find_activities",
      description:
        "Find up to three visible activities, optionally near a location.",
      parameters: z.object({
        location: z.string().trim().max(120).optional(),
        limit: z.number().int().min(1).max(3).optional(),
      }),
      execute: async ({ location = "", limit = 3 }) => {
        const data = await queryClient.fetchQuery(
          activitiesQueryOptions({ location, limit }),
        );
        workflowRef.current.searchActivities(location, limit);
        return {
          activities: data.activities
            .map(toActivity)
            .map((item) => ({
              activityId: item.databaseId,
              title: item.title,
              venue: item.venue,
              startsAt: item.startsAt?.toISOString() ?? null,
              cost: item.cost,
            })),
        };
      },
    }),
    toolFactory({
      name: "select_activity",
      description:
        "Select an activity from the currently visible results by numeric database ID.",
      parameters: z.object({ activityId: z.number().int().positive() }),
      execute: async ({ activityId }) => {
        const activity = workflowRef.current.selectActivityById(activityId);
        if (!activity)
          throw new Error(
            "That activity is not in the visible results. Find activities again first.",
          );
        return { selected: true, activityId, title: activity.title };
      },
    }),
    toolFactory({
      name: "create_plan",
      description:
        "Create a plan for the selected activity and current older-adult profile.",
      parameters: z.object({}),
      needsApproval: true,
      execute: async () => {
        const { household, olderAdult } = setupRef.current;
        const activity = workflowRef.current.selectedActivity;
        if (!household || !olderAdult || !activity)
          throw new Error(
            "Choose a visible activity and complete setup before creating a plan.",
          );
        const plan = await createPlan({
          household_id: household.id,
          older_adult_id: olderAdult.id,
          activity_id: activity.databaseId,
        });
        queryClient.setQueryData(planQueryKey(plan.id), plan);
        void queryClient.invalidateQueries({
          queryKey: plansQueryKey(household.id),
        });
        void navigate({
          to: "/plans/$planId",
          params: { planId: String(plan.id) },
        });
        return { planId: plan.id, status: plan.status };
      },
    }),
    toolFactory({
      name: "request_plan_approval",
      description:
        "Move a draft family-approval plan to waiting for family approval.",
      parameters: planIdSchema,
      needsApproval: true,
      execute: async ({ planId }) =>
        changePlanStatus(
          planId,
          "awaiting_approval",
          queryClient,
          setupRef.current.olderAdult?.sharing_mode,
        ),
    }),
    toolFactory({
      name: "share_plan",
      description:
        "Approve and share a plan that is waiting for family approval.",
      parameters: planIdSchema,
      needsApproval: true,
      execute: async ({ planId }) =>
        changePlanStatus(
          planId,
          "shared",
          queryClient,
          setupRef.current.olderAdult?.sharing_mode,
        ),
    }),
    toolFactory({
      name: "send_plan_notifications",
      description: "Email a shared plan to selected trusted contacts.",
      parameters: z.object({
        planId: z.number().int().positive(),
        contactIds: z.array(z.number().int().positive()).min(1).max(20),
      }),
      needsApproval: true,
      execute: async ({ planId, contactIds }) => {
        const plan = await queryClient.ensureQueryData(
          planQueryOptions(planId),
        );
        if (plan.status !== "shared")
          throw new Error("Only shared plans can be emailed.");
        const validIds = new Set(
          setupRef.current.contacts
            .filter((contact) => contact.email)
            .map((contact) => contact.id),
        );
        if (contactIds.some((id) => !validIds.has(id)))
          throw new Error(
            "One or more selected contacts are unavailable or have no email address.",
          );
        const result = await sendPlanNotifications(planId, contactIds);
        void queryClient.invalidateQueries({
          queryKey: notificationsQueryKey(planId),
        });
        return result;
      },
    }),
    toolFactory({
      name: "offer_support",
      description:
        "Offer one practical kind of support from the demo family view.",
      parameters: z.object({
        planId: z.number().int().positive(),
        supportType: z.enum([
          "join",
          "remind",
          "transport",
          "alternative",
          "booking",
          "encourage",
        ]),
        note: z.string().trim().max(2000).optional(),
      }),
      needsApproval: true,
      execute: async ({ planId, supportType, note }) => {
        if (!locationRef.current.startsWith("/family"))
          throw new Error(
            "Support can only be offered from the demo family view.",
          );
        const plan = await queryClient.ensureQueryData(
          planQueryOptions(planId),
        );
        if (plan.status !== "shared")
          throw new Error("Support can only be offered for a shared plan.");
        const offer = await createSupportOffer(planId, {
          support_type: supportType,
          note: note || null,
        });
        void queryClient.invalidateQueries({
          queryKey: supportOffersQueryKey(planId),
        });
        return {
          offerId: offer.id,
          support: supportTypeLabels[offer.support_type],
        };
      },
    }),
  ];
}

async function changePlanStatus(
  planId: number,
  nextStatus: "awaiting_approval" | "shared",
  queryClient: ReturnType<typeof useQueryClient>,
  sharingMode?: "direct" | "family_approval",
) {
  const current = await queryClient.ensureQueryData(planQueryOptions(planId));
  if (
    nextStatus === "awaiting_approval" &&
    (current.status !== "draft" || sharingMode !== "family_approval")
  )
    throw new Error("Only a draft family-approval plan can request approval.");
  if (nextStatus === "shared" && current.status !== "awaiting_approval")
    throw new Error("Only a plan waiting for approval can be shared.");
  const updated = await updatePlanStatus(planId, nextStatus);
  queryClient.setQueryData(planQueryKey(planId), updated);
  void queryClient.invalidateQueries({
    queryKey: plansQueryKey(updated.household_id),
  });
  return { planId: updated.id, status: updated.status };
}

function approvalDetails(request: {
  approvalItem: RunToolApprovalItem;
  tool: { name: string };
}): PendingApproval {
  return {
    item: request.approvalItem,
    toolName: request.approvalItem.name ?? request.tool.name,
    arguments: parseApprovalArguments(request.approvalItem.arguments),
  };
}

function parseApprovalArguments(value?: string) {
  try {
    return JSON.parse(value ?? "{}") as Record<string, unknown>;
  } catch {
    return {};
  }
}

function ApprovalPanel({
  approval,
  activityTitle,
  contactNames,
  disabled,
  onDecision,
}: {
  approval: PendingApproval;
  activityTitle?: string;
  contactNames: string[];
  disabled: boolean;
  onDecision: (approved: boolean) => void;
}) {
  return (
    <div className="mt-4 rounded-2xl bg-muted p-5">
      <h3 className="text-lg font-bold text-foreground">Confirm this action</h3>
      <p className="mt-2 text-base leading-relaxed text-foreground">
        {approvalSummary(approval, activityTitle, contactNames)}
      </p>
      <p className="mt-2 text-sm text-foreground">
        Nothing happens until you approve.
      </p>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <button
          className="min-h-14 rounded-xl bg-primary px-3 font-bold text-primary-foreground disabled:opacity-50"
          disabled={disabled}
          onClick={() => onDecision(true)}
          type="button"
        >
          Approve action
        </button>
        <button
          className="min-h-14 rounded-xl border border-input bg-background px-3 font-bold text-foreground disabled:opacity-50"
          disabled={disabled}
          onClick={() => onDecision(false)}
          type="button"
        >
          Reject action
        </button>
      </div>
    </div>
  );
}

function approvalSummary(
  { toolName, arguments: args }: PendingApproval,
  activityTitle?: string,
  contactNames: string[] = [],
) {
  if (toolName === "create_plan")
    return `Create a plan for ${activityTitle ?? "the selected activity"}.`;
  if (toolName === "request_plan_approval")
    return `Ask for family approval for plan ${String(args.planId)}.`;
  if (toolName === "share_plan")
    return `Approve and share plan ${String(args.planId)}.`;
  if (toolName === "send_plan_notifications")
    return `Email plan ${String(args.planId)} to ${contactNames.length > 0 ? contactNames.join(", ") : "the selected trusted contacts"}.`;
  if (toolName === "offer_support")
    return `Offer ${String(args.supportType).replaceAll("_", " ")} for plan ${String(args.planId)}${args.note ? ` with the note “${String(args.note)}”` : ""}.`;
  return "Allow the requested change.";
}

function transcriptFromHistory(history: RealtimeItem[]): TranscriptLine[] {
  return history.flatMap((item) => {
    if (item.type !== "message" || item.role === "system") return [];
    const text = item.content
      .map((content) =>
        "text" in content ? content.text : (content.transcript ?? ""),
      )
      .filter(Boolean)
      .join(" ");
    return text
      ? [
          {
            id: item.itemId,
            role:
              item.role === "user" ? ("You" as const) : ("Companion" as const),
            text,
          },
        ]
      : [];
  });
}

function agentInstructions(olderAdult?: {
  name: string;
  preferred_name?: string | null;
  sharing_mode?: "direct" | "family_approval";
}) {
  const name =
    olderAdult?.preferred_name || olderAdult?.name || "the older adult";
  const sharing =
    olderAdult?.sharing_mode === "direct"
      ? "Plans are shared directly after confirmation."
      : "Plans require family approval before sharing.";
  return `You are Count Me In, a warm, brief and respectful activity companion for ${name}. ${sharing} Ask one question at a time. Offer at most three activities verbally. Read important date, venue, cost and accessibility details aloud. Never promise booking, transport, attendance, family response or email delivery. Never perform a mutation without its approval tool flow. Report partial email delivery accurately. If a tool fails, explain the equivalent visible control.`;
}

function voiceStatus(state: VoiceState, muted: boolean) {
  if (muted && ["listening", "thinking", "speaking"].includes(state))
    return "Microphone muted";
  return {
    idle: "Ready when you are",
    requesting_microphone: "Waiting for microphone permission",
    connecting: "Connecting securely",
    listening: "Listening",
    thinking: "Thinking",
    speaking: "Speaking",
    approval: "Waiting for your approval",
    disconnected: "Voice ended",
    error: "Voice unavailable",
  }[state];
}
