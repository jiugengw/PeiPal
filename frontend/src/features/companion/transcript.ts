import type { RealtimeItem } from "@openai/agents/realtime";

export interface TranscriptLine {
  id: string;
  role: "You" | "Companion";
  text: string;
}

export function transcriptFromHistory(history: RealtimeItem[]): TranscriptLine[] {
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
