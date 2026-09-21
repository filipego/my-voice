/**
 * Small, deterministic warning layer derived from the SlopMonster catalogue.
 * It is intentionally advisory: this module never rewrites text or claims that
 * a phrase is wrong. Facts and approved voice rules always outrank these hints.
 */

export type AntiSlopDecision = "warn" | "dismissed" | "allowed";

export interface AntiSlopConfig {
  /** Decisions are keyed by voice area, then by deterministic rule id. */
  exceptions?: Record<string, Record<string, Exclude<AntiSlopDecision, "warn">>>;
}

export interface AntiSlopWarning {
  ruleId: string;
  category: "vocabulary" | "construction" | "punctuation" | "rhythm" | "proof";
  excerpt: string;
  explanation: string;
  decision: AntiSlopDecision;
  areaId?: string;
}

export interface AntiSlopOptions {
  areaId?: string;
  config?: AntiSlopConfig;
}

const VOCABULARY = [
  "delve",
  "leverage",
  "seamless",
  "elevate",
  "robust",
  "unlock",
  "empower",
  "streamline",
  "transformative",
  "holistic",
  "synergy",
  "unparalleled",
  "effortless",
] as const;

const EXACT_VOCABULARY = [
  "journey",
  "realm",
  "ever-evolving",
  "in today's",
  "look no further",
  "deep dive",
  "the secret sauce",
] as const;

const CONSTRUCTION = /\bnot\s+(?:just|only|merely|simply)\b[^.!?]{0,80}\bbut\b/i;
const RHYTHM = /\b\w{4,},\s+\w{4,}(?:,\s+|\s+and\s+)(?:\w{4,}(?:\s+\w+){0,2})[.!?,;:]?/i;
const PROOF = /\b\d[\d,]*(?:\.\d+)?\s*\+?\s*(?:(?:happy|early|active|satisfied|verified|trusted|delighted)\s+)?(?:\w+\s+)?(?:users?|customers?|teams?|members?|clients?|patients?|readers?|subscribers?)\b/i;

function rootPattern(word: string): RegExp {
  const root = word.replace(/(?:ed|ing|ly|e)$/, "");
  return new RegExp(`\\b${root}(?:e|es|ed|ing|ion|ions|ive|al|ally|s|ly|ness)?\\b`, "i");
}

function decisionFor(ruleId: string, options: AntiSlopOptions): AntiSlopDecision {
  const area = options.areaId ?? "core";
  return options.config?.exceptions?.[area]?.[ruleId] ?? "warn";
}

function warning(
  ruleId: AntiSlopWarning["ruleId"],
  category: AntiSlopWarning["category"],
  excerpt: string,
  explanation: string,
  options: AntiSlopOptions,
): AntiSlopWarning {
  return {
    ruleId,
    category,
    excerpt,
    explanation,
    decision: decisionFor(ruleId, options),
    ...(options.areaId ? { areaId: options.areaId } : {}),
  };
}

/** Return at most one deterministic warning per selected rule category. */
export function detectAntiSlopWarnings(text: string, options: AntiSlopOptions = {}): AntiSlopWarning[] {
  const source = text.replace(/[‑\u2013\u2014]/g, (match) => (match === "‑" ? "-" : "—"));
  if (!source.trim()) return [];
  const warnings: AntiSlopWarning[] = [];

  const vocabularyMatch = [...VOCABULARY].map((word) => ({ word, match: source.match(rootPattern(word)) })).find((item) => item.match);
  const exactMatch = [...EXACT_VOCABULARY].map((phrase) => ({ phrase, match: source.match(new RegExp(`\\b${phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i")) })).find((item) => item.match);
  const vocab = vocabularyMatch?.match?.[0] ?? exactMatch?.match?.[0];
  if (vocab) warnings.push(warning("slop.vocabulary", "vocabulary", vocab, "AI vocabulary can make a sentence sound generic; prefer a concrete, plain alternative when it does not conflict with the approved voice.", options));

  const construction = source.match(CONSTRUCTION);
  if (construction) warnings.push(warning("slop.construction", "construction", construction[0], "The ‘not just X, but Y’ construction is a common AI-shaped contrast; consider whether the contrast adds useful information.", options));

  const dashes = source.split(/[.!?]+/).find((sentence) => (sentence.match(/—/g) ?? []).length >= 2);
  if (dashes) warnings.push(warning("slop.punctuation", "punctuation", dashes.trim().slice(0, 120), "Several em dashes in one sentence can create a machine-like cadence; keep them when they are part of the author's intentional voice.", options));

  const rhythm = source.match(RHYTHM);
  if (rhythm) warnings.push(warning("slop.rhythm", "rhythm", rhythm[0], "A rule-of-three list may be rhetorical filler; retain it when it names three factual items or is an approved preference.", options));

  const proof = source.match(PROOF);
  if (proof) warnings.push(warning("slop.proof", "proof", proof[0], "A number beside a people noun may be social proof. Do not remove or change it automatically; verify the fact first.", options));

  return warnings;
}

/** Update one area-scoped decision without mutating the caller's config. */
export function applyAntiSlopDecision(
  config: AntiSlopConfig = {},
  areaId: string,
  ruleId: string,
  decision: Exclude<AntiSlopDecision, "warn">,
): AntiSlopConfig {
  return {
    ...config,
    exceptions: {
      ...(config.exceptions ?? {}),
      [areaId]: {
        ...(config.exceptions?.[areaId] ?? {}),
        [ruleId]: decision,
      },
    },
  };
}

export const lintAntiSlop = detectAntiSlopWarnings;

export const ANTI_SLOP_NOTICE = `# Third-party notices

## SlopMonster

My Voice includes a small, deterministic, advisory subset of the vocabulary,
construction, punctuation, rhythm, and possible-proof checks from SlopMonster
(https://github.com/ItsssssJack/SlopMonster), Copyright (c) 2026 Jack Roberts.

The selected checks are ported from the supplied SlopMonster source and are used
only to surface warnings. They never rewrite text, remove facts, or override
approved voice guidance. The original project is licensed under the MIT License:

MIT License

Copyright (c) 2026 Jack Roberts

Permission is hereby granted, free of charge, to any person obtaining a copy of
this software and associated documentation files (the "Software"), to deal in
the Software without restriction, including without limitation the rights to
use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies
of the Software, and to permit persons to whom the Software is furnished to do
so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
`;
