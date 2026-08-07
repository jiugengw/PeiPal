import {
  readSpeechMode,
  shouldSpeakReply,
  writeSpeechMode,
  type SpeechMode,
} from "@/features/companion/speech";

describe("shouldSpeakReply", () => {
  it("matches the channel the person used by default", () => {
    expect(shouldSpeakReply("auto", "voice")).toBe(true);
    expect(shouldSpeakReply("auto", "text")).toBe(false);
  });

  it("lets the person override the default in both directions", () => {
    expect(shouldSpeakReply("always", "text")).toBe(true);
    expect(shouldSpeakReply("never", "voice")).toBe(false);
  });
});

describe("speech mode storage", () => {
  afterEach(() => localStorage.clear());

  it("defaults to auto and round-trips a stored choice", () => {
    expect(readSpeechMode()).toBe("auto");
    writeSpeechMode("never");
    expect(readSpeechMode()).toBe("never");
  });

  it("ignores a stored value that is no longer a valid mode", () => {
    localStorage.setItem("count-me-in.speech-mode", "shout" as SpeechMode);
    expect(readSpeechMode()).toBe("auto");
  });
});
