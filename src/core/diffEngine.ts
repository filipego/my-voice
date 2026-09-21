export interface Sentence {
  text: string;
  before: string;
  after: string;
  starts: number;
}

function splitSentences(input: string): Sentence[] {
  const result: Sentence[] = [];
  const pattern = /[^.!?\n]+[.!?]*/g;
  let match: RegExpExecArray | null;
  let index = 0;

  while ((match = pattern.exec(input)) !== null) {
    const text = match[0];
    if (text.trim()) {
      result.push({ text, before: "", after: "", starts: index });
    }
    index += text.length;
  }

  return result;
}

export interface SentenceChange {
  before: string;
  after: string;
  kind: "style" | "audience" | "formatting" | "spelling" | "factual" | "structural";
}

const audienceWords = /\b(i|me|my)\b/gi;

function normalizeForCompare(text: string): string {
  return text.replace(/\s+/g, " ").trim().toLowerCase();
}

function wordTokens(text: string): string[] {
  return normalizeForCompare(text)
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .split(/\s+/)
    .filter(Boolean);
}

function isSpellingChange(before: string, after: string): boolean {
  const beforeWords = wordTokens(before);
  const afterWords = wordTokens(after);
  if (beforeWords.length !== afterWords.length) return false;

  const sameWords = beforeWords.every((word, index) => word === afterWords[index]);
  if (sameWords) return false;

  const beforeCompact = beforeWords.join("");
  const afterCompact = afterWords.join("");
  return beforeCompact === afterCompact;
}

function isFactualChange(before: string, after: string): boolean {
  const numbersBefore = before.match(/\b\d+(?:[./-]\d+)*\b/g) ?? [];
  const numbersAfter = after.match(/\b\d+(?:[./-]\d+)*\b/g) ?? [];
  if (numbersBefore.join("|") !== numbersAfter.join("|")) return true;
  const days = /\b(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/gi;
  const beforeDays = before.match(days) ?? [];
  const afterDays = after.match(days) ?? [];
  return beforeDays.length > 0 && afterDays.length > 0 &&
    beforeDays.map((day) => day.toLowerCase()).join("|") !== afterDays.map((day) => day.toLowerCase()).join("|");
}

export function classifyChanges(before: string, after: string): SentenceChange[] {
  const oldSentences = splitSentences(before).map((sentence) => sentence.text.trim());
  const newSentences = splitSentences(after).map((sentence) => sentence.text.trim());
  const changes: SentenceChange[] = [];
  const length = Math.max(oldSentences.length, newSentences.length);

  for (let index = 0; index < length; index += 1) {
    const oldText = oldSentences[index] ?? "";
    const newText = newSentences[index] ?? "";
    if (oldText === newText) continue;

    if (normalizeForCompare(oldText) === normalizeForCompare(newText)) {
      changes.push({ before: oldText, after: newText, kind: "formatting" });
      continue;
    }

    if (isSpellingChange(oldText, newText)) {
      changes.push({ before: oldText, after: newText, kind: "spelling" });
      continue;
    }

    if (isFactualChange(oldText, newText)) {
      changes.push({ before: oldText, after: newText, kind: "factual" });
      continue;
    }

    changes.push({ before: oldText, after: newText, kind: "style" });

    audienceWords.lastIndex = 0;
    const beforeHasAudience = audienceWords.test(oldText);
    audienceWords.lastIndex = 0;
    const afterHasAudience = audienceWords.test(newText);
    if (beforeHasAudience !== afterHasAudience) {
      changes.push({ before: oldText, after: newText, kind: "audience" });
    }
  }

  if (oldSentences.length !== newSentences.length) {
    changes.push({ before, after, kind: "structural" });
  }

  return changes;
}

export function proposeCorrectionRules(
  changes: SentenceChange[],
  scope: "core" | "email" | "essay" | "plan" | "other" = "core",
): string[] {
  const styleChanges = changes.filter((change) => change.kind === "style");
  const audienceChanges = changes.filter((change) => change.kind === "audience");
  const proposals: string[] = [];

  if (styleChanges.length > 0) {
    proposals.push(`In this ${scope} context, prefer: ${styleChanges[0].after || "omit the phrase"}.`);
  }
  if (audienceChanges.length > 0) {
    proposals.push(`Record this audience adjustment for this task rather than making it universal.`);
  }

  return proposals;
}
