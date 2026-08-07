import { fetchClient } from "@/lib/fetchClient";

export class VoiceSessionError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "VoiceSessionError";
    this.status = status;
  }
}

export async function createVoiceSession() {
  const { data, error, response } = await fetchClient.POST("/api/voice/session");
  if (error || !data) {
    const detail = error && typeof error === "object" && "detail" in error && typeof error.detail === "string"
      ? error.detail
      : "Voice is not available right now.";
    throw new VoiceSessionError(detail, response.status);
  }
  return data;
}
