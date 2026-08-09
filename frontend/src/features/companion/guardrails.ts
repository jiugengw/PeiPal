import type { RealtimeOutputGuardrail } from "@openai/agents/realtime";

// Off-topic categories the companion should never linger on. This is a
// stable, swappable placeholder for a real classifier - keep the keywords
// broad rather than trying to enumerate every possible off-topic phrase.
const OFF_TOPIC_KEYWORDS = [
  "stock market",
  "share price",
  "cryptocurrency",
  "bitcoin",
  "election",
  "politic",
  "football score",
  "write me code",
  "programming language",
  "homework",
  "math problem",
  "recipe for",
] as const;

export function mentionsOffTopicKeyword(text: string): boolean {
  const lowered = text.toLowerCase();
  return OFF_TOPIC_KEYWORDS.some((keyword) => lowered.includes(keyword));
}

/**
 * Interrupts companion replies that drift into topics unrelated to PeiPal's
 * job. Backstops the system prompt: even if the model is talked into
 * replying about an unrelated topic, this cuts the response instead of
 * letting it continue.
 */
export const stayOnTopicGuardrail: RealtimeOutputGuardrail = {
  name: "stayOnTopic",
  policyHint:
    "Stay focused on finding activities, the person's mobility or companionship needs, and sending the invitation email. Gently redirect back to that instead.",
  execute: async ({ agentOutput }) => ({
    tripwireTriggered: mentionsOffTopicKeyword(agentOutput),
    outputInfo: { text: agentOutput },
  }),
};
