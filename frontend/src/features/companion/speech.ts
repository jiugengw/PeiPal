/** Where the person's last turn came from. */
export type InputChannel = "voice" | "text";

export type SpeechMode = "auto" | "always" | "never";

export const speechModeLabels: Record<SpeechMode, string> = {
  auto: "Speak when I speak",
  always: "Always speak",
  never: "Never speak",
};

export const speechModes = Object.keys(speechModeLabels) as SpeechMode[];

/**
 * Whether the companion should answer out loud.
 *
 * The default matches the person's own channel: talking gets a spoken reply,
 * typing stays quiet. The screen always carries the detail either way.
 */
export function shouldSpeakReply(
  mode: SpeechMode,
  channel: InputChannel,
): boolean {
  if (mode === "never") return false;
  if (mode === "always") return true;
  return channel === "voice";
}

const STORAGE_KEY = "count-me-in.speech-mode";

export function readSpeechMode(): SpeechMode {
  try {
    const stored = globalThis.localStorage?.getItem(STORAGE_KEY);
    return speechModes.includes(stored as SpeechMode)
      ? (stored as SpeechMode)
      : "auto";
  } catch {
    return "auto";
  }
}

export function writeSpeechMode(mode: SpeechMode) {
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, mode);
  } catch {
    // A blocked storage API must never stop the companion from working.
  }
}
