import { mentionsOffTopicKeyword, stayOnTopicGuardrail } from "@/features/companion/guardrails";

describe("mentionsOffTopicKeyword", () => {
  it("flags a reply that drifts into an unrelated topic", () => {
    expect(mentionsOffTopicKeyword("Let me tell you about the stock market today.")).toBe(true);
  });

  it("allows a reply about the companion's actual job", () => {
    expect(mentionsOffTopicKeyword("Would you like to join the garden walk on Sunday morning?")).toBe(false);
  });
});

describe("stayOnTopicGuardrail", () => {
  it("trips when the agent output is off-topic", async () => {
    const result = await stayOnTopicGuardrail.execute({
      agentOutput: "Here's the latest on the election.",
    } as Parameters<typeof stayOnTopicGuardrail.execute>[0]);

    expect(result.tripwireTriggered).toBe(true);
  });

  it("does not trip for an on-topic reply", async () => {
    const result = await stayOnTopicGuardrail.execute({
      agentOutput: "I found three activities near you.",
    } as Parameters<typeof stayOnTopicGuardrail.execute>[0]);

    expect(result.tripwireTriggered).toBe(false);
  });
});
