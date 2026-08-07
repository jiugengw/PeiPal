import { Volume2, VolumeX } from "lucide-react";
import {
  speechModeLabels,
  speechModes,
  type SpeechMode,
} from "@/features/companion/speech";

export function SpeechToggle({
  mode,
  disabled,
  onChange,
}: {
  mode: SpeechMode;
  disabled: boolean;
  onChange: (mode: SpeechMode) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      {mode === "never" ? (
        <VolumeX aria-hidden="true" size={20} />
      ) : (
        <Volume2 aria-hidden="true" size={20} />
      )}
      <label className="sr-only" htmlFor="companion-speech-mode">
        Speak replies
      </label>
      <select
        className="min-h-12 rounded-xl border border-input bg-background px-3 text-base text-foreground disabled:opacity-60"
        id="companion-speech-mode"
        value={mode}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value as SpeechMode)}
      >
        {speechModes.map((option) => (
          <option key={option} value={option}>
            {speechModeLabels[option]}
          </option>
        ))}
      </select>
    </div>
  );
}
