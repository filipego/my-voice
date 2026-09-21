import { describe, expect, it } from "vitest";
import { classifyCorrection, createCorrectionRecord, decideCorrection } from "../src/core/correctionEngine";
import { initialProfile } from "../src/core/profileEngine";

describe("correction engine", () => {
  it("classifies factual, spelling, formatting, audience, structural, and voice edits", () => {
    const edits = classifyCorrection(
      "We met on Tuesday. I am writing to ask.\nKeep this short.",
      "We met on Wednesday. Can you help?\nKeep this very short.\nThanks.",
    );
    expect(edits.map((edit) => edit.kind)).toEqual(expect.arrayContaining([
      "factual", "audience", "voice", "structural",
    ]));
  });

  it("captures pair context and records non-durable decisions", () => {
    const record = createCorrectionRecord({
      task: "follow-up",
      audience: "client",
      areaId: "business-email",
      profileVersion: 3,
      generatedDraft: "Draft",
      finalRevision: "Final",
    });
    const result = decideCorrection(initialProfile, record, 0, "just-this-time");
    expect(result.record.decisions[0].decision).toBe("just-this-time");
    expect(result.profile).toEqual(initialProfile);
  });
});
