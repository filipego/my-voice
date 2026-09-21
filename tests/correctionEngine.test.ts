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

  it("approves durable guidance and preserves stable proposal identity after factual edits", () => {
    const record = createCorrectionRecord({
      task: "follow-up", audience: "client", areaId: "email", profileVersion: 1,
      generatedDraft: "Meet Tuesday. I am writing to ask.", finalRevision: "Meet Wednesday. Can we meet?",
    });
    const voice = record.proposals.find((proposal) => proposal.editIds.some((id) => record.edits.find((edit) => edit.id === id)?.kind === "voice"));
    expect(voice).toBeDefined();
    const result = decideCorrection(initialProfile, record, record.proposals.indexOf(voice!), "remember");
    expect(result.profile.rules[0].state).toBe("approved");
    expect(result.profile.currentVersion).toBe(1);
  });

  it("does not classify an unchanged weekday as factual", () => {
    const edits = classifyCorrection("Meet Tuesday. I am writing to ask.", "Meet Tuesday. Can we meet?");
    expect(edits.some((edit) => edit.kind === "factual")).toBe(false);
    expect(edits.some((edit) => edit.kind === "voice")).toBe(true);
  });
});
