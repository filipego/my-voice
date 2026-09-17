import { describe, expect, it } from "vitest";
import { initialProfile, proposeRule, setRuleState } from "../src/core/profileEngine";
import { compileSkill } from "../src/core/skillCompiler";

describe("skill compiler", () => {
  it("exports only approved or locked rules", () => {
    let profile = proposeRule(initialProfile, { instruction: "Approved rule.", scope: "email", origin: "direct-instruction" });
    profile = proposeRule(profile, { instruction: "Proposed rule.", origin: "correction-pair" });
    profile = setRuleState(profile, profile.rules[0].id, "approved");

    const skill = compileSkill(profile);
    expect(skill.markdown).toContain("Approved rule.");
    expect(skill.markdown).not.toContain("Proposed rule.");
  });
});
