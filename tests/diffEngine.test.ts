import { describe, expect, it } from "vitest";
import { classifyChanges, proposeCorrectionRules } from "../src/core/diffEngine";

describe("correction diff", () => {
  it("separates style and audience changes", () => {
    const changes = classifyChanges(
      "I am writing to ask whether we can meet.",
      "Can we meet?",
    );
    expect(changes).toHaveLength(2);
    expect(changes[0].kind).toBe("style");
    expect(changes[1].kind).toBe("audience");
  });

  it("scopes style proposals rather than inventing a global command", () => {
    const proposals = proposeCorrectionRules(
      [{ before: "I hope this finds you well.", after: "Are you available on Thursday?", kind: "style" }],
      "email",
    );
    expect(proposals[0]).toContain("email");
  });
});
