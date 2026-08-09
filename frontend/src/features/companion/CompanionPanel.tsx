import { useEffect, useRef, useState, type FormEvent, type PointerEvent as ReactPointerEvent, type KeyboardEvent } from "react";
import { Mic, MicOff, MessageSquare, Pause, Send, Square, X } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { useStagedIntentContext } from "@/hooks/useStagedIntent";
import { ApprovalPanel } from "@/features/companion/ApprovalPanel";
import { SpeechToggle } from "@/features/companion/SpeechToggle";
import {
  useCompanionSession,
  type CompanionMode,
  type CompanionState,
} from "@/features/companion/useCompanionSession";

const MIN_WIDTH = 320;
const MAX_WIDTH = 520;

interface CompanionPanelProps {
  isOpen?: boolean;
  width?: number;
  onOpen?: () => void;
  onClose?: () => void;
  onWidthChange?: (width: number) => void;
}

export function CompanionPanel({
  isOpen,
  width,
  onOpen,
  onClose,
  onWidthChange,
}: CompanionPanelProps) {
  const companion = useCompanionSession();
  useStagedIntentContext();
  const [localOpen, setLocalOpen] = useState(false);
  const [localWidth, setLocalWidth] = useState(380);
  const [typedMessage, setTypedMessage] = useState("");
  const [isResizing, setIsResizing] = useState(false);
  const openState = isOpen ?? localOpen;
  const panelWidth = width ?? localWidth;
  const resizeStart = useRef({ x: 0, width: panelWidth });
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (!openState) return;
    function handleKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") (onClose ?? (() => setLocalOpen(false)))();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [openState, onClose]);

  function open() {
    (onOpen ?? (() => setLocalOpen(true)))();
    if (!companion.isConnected) void companion.startText();
  }

  function close() {
    (onClose ?? (() => setLocalOpen(false)))();
  }

  function beginResize(event: ReactPointerEvent<HTMLDivElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    resizeStart.current = { x: event.clientX, width: panelWidth };
    setIsResizing(true);
  }

  function resize(event: ReactPointerEvent<HTMLDivElement>) {
    if (!isResizing) return;
    const nextWidth = Math.min(
      MAX_WIDTH,
      Math.max(MIN_WIDTH, resizeStart.current.width + resizeStart.current.x - event.clientX),
    );
    (onWidthChange ?? setLocalWidth)(nextWidth);
  }

  function endResize(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setIsResizing(false);
  }

  function resizeWithKeyboard(event: KeyboardEvent<HTMLDivElement>) {
    const step = event.shiftKey ? 40 : 16;
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      (onWidthChange ?? setLocalWidth)(Math.min(MAX_WIDTH, panelWidth + step));
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      (onWidthChange ?? setLocalWidth)(Math.max(MIN_WIDTH, panelWidth - step));
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!typedMessage.trim() || companion.pendingApproval) return;
    companion.sendTypedMessage(typedMessage);
    setTypedMessage("");
  }

  const recipientNames: string[] = [];
  const hasConversation = companion.transcript.length > 0 || companion.isConnected;
  const shouldPulse = hasConversation && companion.isConnected && !reduceMotion;

  return (
    <aside
      className={openState ? "relative z-30 min-h-0 min-w-0" : "fixed right-4 bottom-4 z-40"}
      aria-label="PeiPal companion"
    >
      {!openState ? (
        <motion.button
          className="ml-auto flex min-h-14 items-center gap-3 rounded-xl bg-primary px-5 font-bold text-primary-foreground shadow-[0_14px_34px_rgb(37_44_64_/_0.22)] hover:bg-foreground"
          onClick={open}
          type="button"
          animate={
            shouldPulse
              ? {
                  boxShadow: [
                    "0 14px 34px rgb(37 44 64 / 0.22), 0 0 0 0 rgb(61 82 160 / 0.65)",
                    "0 14px 34px rgb(37 44 64 / 0.22), 0 0 0 16px rgb(61 82 160 / 0)",
                  ],
                  scale: [1, 1.03],
                }
              : undefined
          }
          transition={
            shouldPulse
              ? { duration: 1.4, repeat: Infinity, ease: "easeOut" }
              : undefined
          }
          aria-label={
            hasConversation ? "Reopen conversation (Ask or type)" : undefined
          }
            aria-expanded={openState}
        >
          <MessageSquare aria-hidden="true" size={22} />
          {hasConversation ? "Reopen conversation" : "Ask or type"}
        </motion.button>
      ) : (
        <div className="relative flex h-full min-h-0 flex-col overflow-y-auto border-l border-border bg-muted p-5 shadow-[-14px_0_35px_rgb(37_44_64_/_0.08)] max-[1023px]:fixed max-[1023px]:inset-x-0 max-[1023px]:bottom-0 max-[1023px]:z-40 max-[1023px]:max-h-[82dvh] max-[1023px]:rounded-t-2xl max-[1023px]:border-t max-[1023px]:border-l-0">
          <div
            className="absolute left-0 top-0 hidden h-full w-3 -translate-x-1/2 cursor-col-resize items-center justify-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground lg:flex"
            role="separator"
            aria-label="Resize companion sidebar"
            aria-orientation="vertical"
            aria-valuemin={MIN_WIDTH}
            aria-valuemax={MAX_WIDTH}
            aria-valuenow={panelWidth}
            tabIndex={0}
            onKeyDown={resizeWithKeyboard}
            onPointerDown={beginResize}
            onPointerMove={resize}
            onPointerUp={endResize}
          >
            <span className="h-16 w-1 rounded-full bg-steel-blue" aria-hidden="true" />
          </div>
          <div className="flex items-start justify-between gap-4 border-b border-border pb-4">
            <div>
              <h2 className="text-xl font-bold text-foreground">Companion</h2>
              <p className="mt-1 text-base text-foreground" aria-live="polite">
                {companionStatus(
                  companion.state,
                  companion.mode,
                  companion.isMuted,
                )}
              </p>
            </div>
            <button
              className="grid min-h-12 min-w-12 place-items-center rounded-xl text-foreground hover:bg-muted"
              onClick={close}
              type="button"
              aria-label="Minimize companion"
              title="Minimize companion"
            >
              <X aria-hidden="true" />
            </button>
          </div>

          <div className="flex items-center justify-between gap-3 border-b border-border py-3">
            <SpeechToggle
              mode={companion.speechMode}
              disabled={!companion.isSpeechAvailable}
              onChange={companion.setSpeechMode}
            />
            {!companion.isSpeechAvailable ? (
              <span className="text-sm text-foreground">Typing stays quiet</span>
            ) : null}
          </div>

          {companion.transcript.length > 0 ? (
            <div
              className="max-h-56 overflow-y-auto border-b border-border py-4"
              aria-live="polite"
            >
              {companion.transcript.slice(-6).map((line) => (
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
              Ask for what you would like. Anything the companion finds appears
              on the page behind this panel, and nothing is sent or saved until
              you confirm it there.
            </p>
          )}

          {companion.pendingApproval ? (
            <ApprovalPanel
              summary={approvalSummary(recipientNames)}
              disabled={companion.state !== "approval"}
              onDecision={(approved) =>
                void companion.resolveApproval(approved)
              }
            />
          ) : null}

          {companion.errorMessage ? (
            <p
              className="mt-4 rounded-xl bg-muted p-4 font-bold text-foreground"
              role="alert"
            >
              {companion.errorMessage}
            </p>
          ) : null}

          {!companion.isConnected ? (
            <button
              className="mt-4 flex min-h-14 w-full items-center justify-center gap-3 rounded-xl bg-primary px-5 font-bold text-primary-foreground hover:bg-foreground disabled:opacity-60"
              disabled={
                companion.state === "connecting" ||
                companion.state === "requesting_microphone"
              }
              onClick={() => void companion.startText()}
              type="button"
            >
              <MessageSquare aria-hidden="true" />
              {companion.state === "connecting" ? "Connecting…" : "Reconnect"}
            </button>
          ) : (
            <>
              <form className="mt-4 flex gap-2" onSubmit={submit}>
                <label className="sr-only" htmlFor="companion-message">
                  Type a message
                </label>
                <input
                  className="min-h-14 min-w-0 flex-1 rounded-xl border border-input bg-background px-4 text-base text-foreground"
                  id="companion-message"
                  value={typedMessage}
                  onChange={(event) => setTypedMessage(event.target.value)}
                  disabled={Boolean(companion.pendingApproval)}
                  placeholder="Type a message…"
                />
                <button
                  className="grid min-h-14 min-w-14 place-items-center rounded-xl bg-primary text-primary-foreground disabled:opacity-50"
                  disabled={
                    !typedMessage.trim() || Boolean(companion.pendingApproval)
                  }
                  type="submit"
                  aria-label="Send typed message"
                >
                  <Send aria-hidden="true" size={20} />
                </button>
              </form>

              {companion.mode === "text" ? (
                <div className="mt-3 grid gap-2">
                  <button
                    className="flex min-h-14 w-full items-center justify-center gap-3 rounded-xl border border-input bg-background px-5 font-bold text-foreground hover:bg-muted"
                    onClick={() => void companion.startVoice()}
                    type="button"
                  >
                    <Mic aria-hidden="true" size={20} />
                    Start voice
                  </button>
                  <button
                    className="min-h-11 text-base font-bold text-foreground underline"
                    onClick={companion.end}
                    type="button"
                  >
                    End conversation
                  </button>
                </div>
              ) : (
                <div className="mt-3 grid grid-cols-3 gap-2">
                  <button
                    className="flex min-h-14 flex-col items-center justify-center rounded-xl border border-input bg-background px-2 text-sm font-bold text-foreground hover:bg-muted"
                    onClick={companion.toggleMute}
                    type="button"
                  >
                    {companion.isMuted ? (
                      <Mic aria-hidden="true" size={20} />
                    ) : (
                      <MicOff aria-hidden="true" size={20} />
                    )}
                    {companion.isMuted ? "Unmute" : "Mute"}
                  </button>
                  <button
                    className="flex min-h-14 flex-col items-center justify-center rounded-xl border border-input bg-background px-2 text-sm font-bold text-foreground hover:bg-muted"
                    onClick={companion.interrupt}
                    type="button"
                  >
                    <Pause aria-hidden="true" size={20} />
                    Stop speech
                  </button>
                  <button
                    className="flex min-h-14 flex-col items-center justify-center rounded-xl border border-input bg-background px-2 text-sm font-bold text-foreground hover:bg-muted"
                    onClick={companion.end}
                    type="button"
                  >
                    <Square aria-hidden="true" size={18} />
                    End voice
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </aside>
  );
}

function approvalSummary(recipientNames: string[]) {
  const names =
    recipientNames.length > 0
      ? recipientNames.join(", ")
      : "the selected trusted contacts";
  return `Send this plan by email to ${names}. This is the only step that reaches people outside the app.`;
}

function companionStatus(
  state: CompanionState,
  mode: CompanionMode,
  muted: boolean,
) {
  if (muted && ["ready", "thinking", "speaking"].includes(state))
    return "Microphone muted";
  if (state === "ready") return mode === "voice" ? "Listening" : "Ready";
  return {
    idle: "Ready when you are",
    requesting_microphone: "Waiting for microphone permission",
    connecting: "Connecting securely",
    ready: "Ready",
    thinking: "Thinking",
    speaking: "Speaking",
    approval: "Waiting for your approval",
    disconnected: "Companion ended",
    error: "Companion unavailable",
  }[state];
}
