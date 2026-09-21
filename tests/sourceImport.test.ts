import { describe, it, expect, vi } from "vitest";
import { normalizeText, isDuplicateText, importWritingFile, MAX_IMPORT_BYTES } from "../src/core/sourceImport";

vi.mock("mammoth", () => ({
  extractRawText: vi.fn().mockResolvedValue({ value: "Extracted docx paragraph." }),
}));

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

  it("imports txt and markdown with included paragraph decisions", async () => {
    const preview = await importWritingFile(new File(["First.\n\nSecond."], "note.md", { type: "text/markdown" }));
    expect(preview.type).toBe("md");
    expect(preview.filename).toBe("note.md");
    expect(preview.paragraphs).toEqual([
      { id: expect.stringMatching(/^p_/), text: "First.", decision: "included" },
      { id: expect.stringMatching(/^p_/), text: "Second.", decision: "included" },
    ]);
  });

  it("rejects unsupported, empty, and oversized files", async () => {
    await expect(importWritingFile(new File(["x"], "note.pdf"))).rejects.toThrow(/unsupported/i);
    await expect(importWritingFile(new File(["\n\n"], "empty.txt"))).rejects.toThrow(/empty/i);
    const oversized = new File(["x".repeat(MAX_IMPORT_BYTES + 1)], "large.txt");
    await expect(importWritingFile(oversized)).rejects.toThrow(/large|size/i);
  });

  it("keeps paragraph IDs stable across equivalent content", async () => {
    const first = await importWritingFile(new File(["One.\n\nTwo."], "a.txt"));
    const second = await importWritingFile(new File(["One.\n\n Two. "], "b.txt"));
    expect(first.hash).toBe(second.hash);
    expect(first.paragraphs.map((paragraph) => paragraph.id)).toEqual(second.paragraphs.map((paragraph) => paragraph.id));
  });

  it("extracts raw text from docx without rendering HTML", async () => {
    const preview = await importWritingFile(new File([new Uint8Array([80, 75])], "sample.docx"));
    expect(preview.type).toBe("docx");
    expect(preview.paragraphs[0].text).toBe("Extracted docx paragraph.");
  });
});
