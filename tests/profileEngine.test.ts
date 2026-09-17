import { describe, expect, it } from "vitest";
import { initialProfile, proposeRule, publishProfile, rollbackToVersion, setRuleState } from "../src/core/profileEngine";

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
});
