import { useState, type FormEvent } from "react";
import { Mic, MicOff, MessageSquare, Pause, Send, Square, X } from "lucide-react";
import { useStagedIntentContext } from "@/hooks/useStagedIntent";
import { ApprovalPanel } from "@/features/companion/ApprovalPanel";
import { SpeechToggle } from "@/features/companion/SpeechToggle";
import {
  useCompanionSession,
  type CompanionMode,
  type CompanionState,
} from "@/features/companion/useCompanionSession";

export function CompanionPanel() {
  const companion = useCompanionSession();
  useStagedIntentContext();
  const [isOpen, setIsOpen] = useState(false);
  const [typedMessage, setTypedMessage] = useState("");

  function open() {
    setIsOpen(true);
    if (!companion.isConnected) void companion.startText();
  }

  function close() {
    if (companion.isConnected) companion.end();
    setIsOpen(false);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!typedMessage.trim() || companion.pendingApproval) return;
    companion.sendTypedMessage(typedMessage);
    setTypedMessage("");
  }

  const recipientNames: string[] = [];

  return (
    <aside
      className="fixed right-4 bottom-4 z-40 w-[calc(100%-2rem)] max-w-[390px]"
      aria-label="PeiPal companion"
    >
      {!isOpen ? (
        <button
          className="ml-auto flex min-h-14 items-center gap-3 rounded-xl bg-primary px-5 font-bold text-primary-foreground shadow-[0_14px_34px_rgb(37_44_64_/_0.22)] hover:bg-foreground"
          onClick={open}
          type="button"
        >
          <MessageSquare aria-hidden="true" size={22} /> Ask or type
        </button>
      ) : (
        <div className="rounded-2xl bg-background p-5 shadow-[0_22px_55px_rgb(37_44_64_/_0.22)]">
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
              aria-label="Close companion"
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
                <button
                  className="mt-3 flex min-h-14 w-full items-center justify-center gap-3 rounded-xl border border-input bg-background px-5 font-bold text-foreground hover:bg-muted"
                  onClick={() => void companion.startVoice()}
                  type="button"
                >
                  <Mic aria-hidden="true" size={20} />
                  Start voice
                </button>
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
