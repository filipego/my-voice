import { describe, expect, it } from "vitest";
import { initialProfile, proposeRule, setRuleState } from "../src/core/profileEngine";
import { compileSkill, compileSkillPackage } from "../src/core/skillCompiler";

describe("skill compiler", () => {
  it("exports only approved or locked rules", () => {
    let profile = proposeRule(initialProfile, { instruction: "Approved rule.", scope: "email", origin: "direct-instruction" });
    profile = proposeRule(profile, { instruction: "Proposed rule.", origin: "correction-pair" });
    profile = setRuleState(profile, profile.rules[0].id, "approved");

    const skill = compileSkill(profile);
    expect(skill.markdown).toContain("Approved rule.");
    expect(skill.markdown).not.toContain("Proposed rule.");
  });

  it("compiles shared core and populated standard and dynamic areas into references", () => {
    let profile = initialProfile;
    for (const [instruction, scope, state] of [
      ["Use plain language.", "core", "locked"],
      ["Personal email stays warm and brief.", "personal-email", "approved"],
      ["Business email leads with the request.", "business-email", "approved"],
      ["Website copy favors concrete benefits.", "website-copy", "approved"],
      ["Research notes use explicit caveats.", "research-notes", "approved"],
      ["Do not ship this proposed rule.", "personal-email", "proposed"],
      ["Essay stays unrelated.", "essay", "approved"],
    ] as const) {
      profile = proposeRule(profile, { instruction, scope, origin: "direct-instruction" });
      const rule = profile.rules.at(-1)!;
      if (state !== "proposed") profile = setRuleState(profile, rule.id, state);
    }
    profile = { ...profile, currentVersion: 7 };

    const packageResult = compileSkillPackage(profile, { generatedAt: "2026-09-20T00:00:00.000Z" });
    expect(Object.keys(packageResult.files)).toEqual([
      "SKILL.md",
      "references/anti-slop.md",
      "references/business-email.md",
      "references/essay.md",
      "references/personal-email.md",
      "references/research-notes.md",
      "references/shared-core.md",
      "references/website-copy.md",
      "THIRD_PARTY_NOTICES.md",
      "manifest.json",
    ]);
    expect(packageResult.files["references/shared-core.md"]).toContain("Use plain language.");
    expect(packageResult.files["references/personal-email.md"]).toContain("Personal email stays warm and brief.");
    expect(packageResult.files["references/personal-email.md"]).not.toContain("Do not ship this proposed rule.");
    expect(packageResult.files["references/business-email.md"]).toContain("Business email leads with the request.");
    expect(packageResult.files["references/website-copy.md"]).toContain("Website copy favors concrete benefits.");
    expect(packageResult.files["references/research-notes.md"]).toContain("Research notes use explicit caveats.");
    expect(packageResult.files["SKILL.md"]).not.toContain("Essay stays unrelated.");
    expect(packageResult.manifest).toMatchObject({
      skillName: "my-voice",
      profileVersion: 7,
      areaIds: ["business-email", "essay", "personal-email", "research-notes", "website-copy"],
    });
  });

  it("routes the selected area without loading unrelated area references", () => {
    let profile = proposeRule(initialProfile, { instruction: "Keep personal notes intimate.", scope: "personal-email", origin: "direct-instruction" });
    profile = setRuleState(profile, profile.rules[0].id, "approved");
    profile = proposeRule(profile, { instruction: "Use conversion-focused headlines.", scope: "website-copy", origin: "direct-instruction" });
    profile = setRuleState(profile, profile.rules[1].id, "approved");
    const packageResult = compileSkillPackage(profile, { selectedAreaId: "personal-email", generatedAt: "2026-09-20T00:00:00.000Z" });
    const router = packageResult.files["SKILL.md"];
    expect(router).toContain("selected voice area");
    expect(router).toContain("references/personal-email.md");
    expect(router).not.toContain("references/website-copy.md");
    expect(router).not.toContain("Use conversion-focused headlines.");
  });

  it("states conflict priority and produces deterministic content checksums", () => {
    let profile = proposeRule(initialProfile, { instruction: "Prefer direct openings.", scope: "core", origin: "direct-instruction" });
    profile = setRuleState(profile, profile.rules[0].id, "locked");
    const first = compileSkillPackage(profile, { generatedAt: "2026-09-20T00:00:00.000Z" });
    const second = compileSkillPackage(profile, { generatedAt: "2027-01-01T00:00:00.000Z" });
    expect(first.files["SKILL.md"]).toMatch(/task facts.*current instructions.*locked preferences.*selected area.*shared core.*anti-slop/i);
    expect(first.manifest.checksums).toEqual(second.manifest.checksums);
    expect(first.files["manifest.json"]).toContain('"profileVersion": 1');
  });
});
