import { describe, it, expect } from "vitest";
import { normalizeText, isDuplicateText } from "../src/core/sourceImport";

describe("source import", () => {
  it("normalizes paragraphs and produces a stable id and hash", () => {
    const a = normalizeText("First line.\n\n  Second line.  \n");
    const b = normalizeText("First line.\n\nSecond line.");
    expect(a.paragraphs).toEqual(["First line.", "Second line."]);
    expect(a.id).toBe(b.id);
    expect(a.hash).toBe(b.hash);
    expect(a.text).toBe("First line.\n\nSecond line.");
  });

  it("detects duplicates across insignificant whitespace", () => {
    expect(isDuplicateText("Same idea.  ", ["same idea."])).toBe(true);
    expect(isDuplicateText("Different idea.", ["same idea."])).toBe(false);
  });
});
