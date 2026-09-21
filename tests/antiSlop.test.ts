import { describe, expect, it } from "vitest";
import {
  applyAntiSlopDecision,
  detectAntiSlopWarnings,
  type AntiSlopConfig,
} from "../src/core/antiSlop";

describe("anti-slop warnings", () => {
  it("detects the selected deterministic SlopMonster rules with stable excerpts", () => {
    const warnings = detectAntiSlopWarnings(
      "We leverage a seamless workflow. It is not just fast, but robust. Trusted, reliable and built to last. Loved by 10,000 happy users.",
      { areaId: "personal-email" },
    );

    expect(warnings.map((warning) => warning.ruleId)).toEqual([
      "slop.vocabulary",
      "slop.construction",
      "slop.rhythm",
      "slop.proof",
    ]);
    expect(warnings[0]).toMatchObject({
      excerpt: "leverage",
      decision: "warn",
      explanation: expect.stringContaining("AI vocabulary"),
      areaId: "personal-email",
    });
  });

  it("only warns and never rewrites facts or source text", () => {
    const source = "The appointment is on 12 May at 10:00 with Jordan.";
    const warnings = detectAntiSlopWarnings(source);

    expect(warnings).toEqual([]);
    expect(source).toBe("The appointment is on 12 May at 10:00 with Jordan.");
  });

  it("keeps area-scoped dismiss and allow decisions deterministic", () => {
    let config: AntiSlopConfig = { exceptions: {} };
    config = applyAntiSlopDecision(config, "personal-email", "slop.vocabulary", "allowed");
    config = applyAntiSlopDecision(config, "website-copy", "slop.vocabulary", "dismissed");

    const personal = detectAntiSlopWarnings("We leverage the details.", { areaId: "personal-email", config });
    const website = detectAntiSlopWarnings("We leverage the details.", { areaId: "website-copy", config });
    const essay = detectAntiSlopWarnings("We leverage the details.", { areaId: "essay", config });

    expect(personal[0].decision).toBe("allowed");
    expect(website[0].decision).toBe("dismissed");
    expect(essay[0].decision).toBe("warn");
  });
});
