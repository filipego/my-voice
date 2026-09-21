import { describe, expect, it } from "vitest";
import { initialProfile, proposeRule, publishProfile, rollbackToVersion, setRuleState, editRule, supersedeRule, resolveContradiction } from "../src/core/profileEngine";

describe("profile engine", () => {
  it("keeps proposed rules proposed until approved", () => {
    const profile = proposeRule(initialProfile, { instruction: "Open with the request.", origin: "correction-pair" });
    expect(profile.rules).toHaveLength(1);
    expect(profile.rules[0].state).toBe("proposed");
  });

  it("publishes and restores profile versions", () => {
    let profile = proposeRule(initialProfile, { instruction: "Direct request over lead-in.", scope: "email", origin: "direct-instruction" });
    profile = setRuleState(profile, profile.rules[0].id, "approved");
    profile = publishProfile(profile, "First version");

    profile = proposeRule(profile, { instruction: "Use concrete examples.", origin: "writing-sample" });
    profile = publishProfile(profile, "Second version");
    profile = rollbackToVersion(profile, 1);

    expect(profile.currentVersion).toBe(3);
    expect(profile.rules).toHaveLength(1);
    expect(profile.rules[0].instruction).toBe("Direct request over lead-in.");
  });

  it("protects locked rules from edits and records a superseding rule", () => {
    let profile = proposeRule(initialProfile, { instruction: "Lead with the request.", origin: "direct-instruction" });
    const ruleId = profile.rules[0].id;
    const superseded = supersedeRule(profile, ruleId, { instruction: "State the request plainly.", origin: "direct-instruction" });
    expect(superseded.rules.find((rule) => rule.id === ruleId)?.state).toBe("superseded");
    expect(superseded.rules.at(-1)?.state).toBe("proposed");
    profile = setRuleState(profile, ruleId, "locked");
    expect(editRule(profile, ruleId, "Hide the request in context.").rules[0].instruction).toBe("Lead with the request.");
    expect(supersedeRule(profile, ruleId, { instruction: "Blocked.", origin: "direct-instruction" })).toBe(profile);
  });

  it("resolves contradictory active rules without leaving two active instructions", () => {
    let profile = proposeRule(initialProfile, { instruction: "Use short sentences.", scope: "core", origin: "direct-instruction" });
    profile = setRuleState(profile, profile.rules[0].id, "approved");
    profile = proposeRule(profile, { instruction: "Use long flowing sentences.", scope: "core", origin: "direct-instruction" });
    profile = setRuleState(profile, profile.rules[1].id, "approved");
    profile = resolveContradiction(profile, profile.rules[1].id, [profile.rules[0].id]);
    expect(profile.rules.filter((rule) => ["approved", "locked"].includes(rule.state))).toHaveLength(1);
    expect(profile.rules[0].state).toBe("rejected");
  });

  it("keeps source-linked evidence records on proposed rules", () => {
    const profile = proposeRule(initialProfile, {
      instruction: "Lead with the request.",
      origin: "writing-sample",
      evidence: [{ sourceId: "src_1", paragraphId: "p_1", excerpt: "Lead with the request." }],
    });
    expect(profile.rules[0].evidence[0]).toEqual({ sourceId: "src_1", paragraphId: "p_1", excerpt: "Lead with the request." });
  });
});
