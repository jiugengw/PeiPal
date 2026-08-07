import { useEffect, useRef, useState, type MutableRefObject } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import type { RunToolApprovalItem } from "@openai/agents";
import type { RealtimeSession } from "@openai/agents/realtime";
import { useActivityWorkflow } from "@/features/activities/activityWorkflowContext";
import { useSetupProgress } from "@/features/setup/useSetupProgress";
import { useStagedIntentContext } from "@/hooks/useStagedIntent";
import {
  createVoiceSession,
  VoiceSessionError,
} from "@/features/companion/api/voiceApi";
import { agentInstructions } from "@/features/companion/instructions";
import { createCompanionTools } from "@/features/companion/tools";
import {
  readSpeechMode,
  shouldSpeakReply,
  writeSpeechMode,
  type SpeechMode,
} from "@/features/companion/speech";
import {
  transcriptFromHistory,
  type TranscriptLine,
} from "@/features/companion/transcript";

const MODEL = "gpt-realtime-2.1";
/** How much of an earlier text conversation is carried into a voice session. */
const REPLAY_LINES = 6;

export type CompanionMode = "text" | "voice";

export type CompanionState =
  | "idle"
  | "connecting"
  | "requesting_microphone"
  | "ready"
  | "thinking"
  | "speaking"
  | "approval"
  | "disconnected"
  | "error";

export interface PendingApproval {
  item: RunToolApprovalItem;
  toolName: string;
}

const CONNECTED_STATES: CompanionState[] = [
  "ready",
  "thinking",
  "speaking",
  "approval",
];

export function useCompanionSession() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const workflow = useActivityWorkflow();
  const setup = useSetupProgress();
  const stagedIntent = useStagedIntentContext();

  const sessionRef = useRef<RealtimeSession | null>(null);
  const workflowRef = useRef(workflow);
  const setupRef = useRef(setup);
  const intentRef = useRef(stagedIntent);
  const transcriptRef = useRef<TranscriptLine[]>([]);
  const currentModeRef = useRef<CompanionMode>("text");

  const [mode, setMode] = useState<CompanionMode>("text");
  const [state, setState] = useState<CompanionState>("idle");
  const [transcript, setTranscript] = useState<TranscriptLine[]>([]);
  const [errorMessage, setErrorMessage] = useState("");
  const [isMuted, setIsMuted] = useState(false);
  const [speechMode, setSpeechModeState] = useState<SpeechMode>(readSpeechMode);
  const [pendingApproval, setPendingApproval] = useState<PendingApproval>();
  const speechModeRef = useRef<SpeechMode>(speechMode);

  useEffect(() => () => sessionRef.current?.close(), []);
  useKeepRefFresh(workflowRef, workflow);
  useKeepRefFresh(setupRef, setup);
  useKeepRefFresh(intentRef, stagedIntent);
  useKeepRefFresh(transcriptRef, transcript);

  function setSpeechMode(next: SpeechMode) {
    speechModeRef.current = next;
    writeSpeechMode(next);
    setSpeechModeState(next);
    // A live voice session keeps talking unless the person turned speech off.
    if (sessionRef.current && currentModeRef.current === "voice")
      sessionRef.current.transport.updateSessionConfig({
        outputModalities: next === "never" ? ["text"] : ["audio"],
      });
  }

  async function connect(nextMode: CompanionMode) {
    setErrorMessage("");
    // Upgrading to voice keeps the visible conversation and replays it below.
    const carriedOver = nextMode === "voice" ? transcriptRef.current : [];
    if (nextMode === "text") setTranscript([]);
    sessionRef.current?.close();
    sessionRef.current = null;
    setMode(nextMode);
    currentModeRef.current = nextMode;

    try {
      if (nextMode === "voice") {
        if (!navigator.mediaDevices?.getUserMedia)
          throw new Error("This browser does not provide microphone access.");
        setState("requesting_microphone");
        const permissionStream = await navigator.mediaDevices.getUserMedia({
          audio: true,
        });
        permissionStream.getTracks().forEach((track) => track.stop());
      }

      setState("connecting");
      const [credential, agents, realtime] = await Promise.all([
        createVoiceSession(),
        import("@openai/agents"),
        import("@openai/agents/realtime"),
      ]);
      const agent = new realtime.RealtimeAgent({
        name: "PeiPal companion",
        instructions: agentInstructions(setupRef.current.olderAdult),
        tools: createCompanionTools({
          toolFactory: agents.tool,
          queryClient,
          navigate,
          workflowRef,
          setupRef,
          intentRef,
        }),
      });
      const session = new realtime.RealtimeSession(agent, {
        model: MODEL,
        transport: nextMode === "voice" ? "webrtc" : "websocket",
        toolExecution: { preApprovalInputGuardrails: true },
        workflowName: "PeiPal browser companion",
        config:
          nextMode === "voice"
            ? {
                outputModalities:
                  speechModeRef.current === "never" ? ["text"] : ["audio"],
              }
            : // Text mode has no microphone, so nothing should listen for turns.
              {
                outputModalities: ["text"],
                audio: { input: { turnDetection: null } },
              },
      });
      sessionRef.current = session;

      session.on("history_updated", (history) => {
        const lines = transcriptFromHistory(history);
        setTranscript(lines.filter((line) => !isReplayLine(line)));
      });
      session.on("agent_start", () => setState("thinking"));
      session.on("agent_end", () => setState("ready"));
      session.on("audio_start", () => setState("speaking"));
      session.on("audio_stopped", () => setState("ready"));
      session.on("audio_interrupted", () => setState("ready"));
      session.on("tool_approval_requested", (_context, _agent, request) => {
        if (request.type !== "function_approval") return;
        setPendingApproval({
          item: request.approvalItem,
          toolName: request.approvalItem.name ?? request.tool.name,
        });
        setState("approval");
      });
      session.on("error", () =>
        fail(
          "The companion connection ran into a problem. You can continue with the visible controls.",
        ),
      );
      session.transport.on("connection_change", (status) => {
        if (status === "disconnected" && sessionRef.current === session)
          setState("disconnected");
      });

      await session.connect({ apiKey: credential.client_secret });
      if (carriedOver.length > 0) replayContext(session, carriedOver);
      setState("ready");
    } catch (error) {
      fail(connectionErrorMessage(error));
    }
  }

  function fail(message: string) {
    sessionRef.current?.close();
    sessionRef.current = null;
    setErrorMessage(message);
    setPendingApproval(undefined);
    setState("error");
  }

  function end() {
    sessionRef.current?.close();
    sessionRef.current = null;
    setPendingApproval(undefined);
    setIsMuted(false);
    setState("disconnected");
  }

  function sendTypedMessage(text: string) {
    const session = sessionRef.current;
    const message = text.trim();
    if (!message || !session || pendingApproval) return;
    if (shouldSpeakReply(speechModeRef.current, "text")) {
      session.sendMessage(message);
      return;
    }
    // Answer this one turn in text, without changing what a spoken turn does.
    session.transport.sendMessage(message, {}, { triggerResponse: false });
    session.transport.sendEvent({
      type: "response.create",
      response: { output_modalities: ["text"] },
    });
  }

  function toggleMute() {
    const session = sessionRef.current;
    if (!session) return;
    const next = !isMuted;
    session.mute(next);
    setIsMuted(next);
  }

  async function resolveApproval(approved: boolean) {
    const session = sessionRef.current;
    if (!session || !pendingApproval) return;
    const approval = pendingApproval;
    setPendingApproval(undefined);
    setState("thinking");
    if (approved) await session.approve(approval.item);
    else
      await session.reject(approval.item, {
        message:
          "The person chose not to go ahead. Offer the equivalent visible control if helpful.",
      });
  }

  return {
    mode,
    state,
    transcript,
    errorMessage,
    isMuted,
    speechMode,
    pendingApproval,
    isConnected: CONNECTED_STATES.includes(state),
    isSpeechAvailable: mode === "voice",
    setSpeechMode,
    startText: () => connect("text"),
    startVoice: () => connect("voice"),
    sendTypedMessage,
    toggleMute,
    interrupt: () => sessionRef.current?.interrupt(),
    end,
    resolveApproval,
  };
}

function useKeepRefFresh<T>(ref: MutableRefObject<T>, value: T) {
  useEffect(() => {
    ref.current = value;
  }, [ref, value]);
}

const REPLAY_PREFIX = "Earlier in this conversation:";

/**
 * WebRTC and WebSocket sessions do not share history, so an upgrade to voice
 * hands the model a short recap instead of silently forgetting everything.
 */
function replayContext(session: RealtimeSession, lines: TranscriptLine[]) {
  const recap = lines
    .slice(-REPLAY_LINES)
    .map((line) => `${line.role}: ${line.text}`)
    .join("\n");
  session.transport.sendMessage(
    `${REPLAY_PREFIX}\n${recap}`,
    {},
    { triggerResponse: false },
  );
}

function isReplayLine(line: TranscriptLine) {
  return line.role === "You" && line.text.startsWith(REPLAY_PREFIX);
}

function connectionErrorMessage(error: unknown) {
  if (error instanceof VoiceSessionError && error.status === 401)
    return "Your login session has expired. Log in again, then start the companion.";
  if (error instanceof DOMException && error.name === "NotAllowedError")
    return "Microphone access was denied. You can still type, and every button and form still works.";
  return error instanceof Error
    ? error.message
    : "The companion is not available right now.";
}
