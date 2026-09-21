import { classifyChanges, type SentenceChange } from "./diffEngine";
import { proposeRule, publishProfile, type Profile, type RuleScope } from "./profileEngine";

export type CorrectionDecision = "remember" | "context-only" | "just-this-time" | "wrong-interpretation";

export interface ClassifiedEdit {
  id: string;
  before: string;
  after: string;
  kind: SentenceChange["kind"] | "voice" | "structural";
}

export interface CorrectionProposal {
  id: string;
  instruction: string;
  editIds: string[];
  rejected?: boolean;
}

export interface CorrectionDecisionRecord {
  proposalId: string;
  decision: CorrectionDecision;
  createdAt: string;
}

export interface CorrectionRecord {
  id: string;
  task: string;
  audience: string;
  areaId: string;
  profileVersion: number;
  generatedDraft: string;
  finalRevision: string;
  edits: ClassifiedEdit[];
  proposals: CorrectionProposal[];
  decisions: CorrectionDecisionRecord[];
  createdAt: string;
}

export interface CorrectionInput {
  task: string;
  audience: string;
  areaId: string;
  profileVersion: number;
  generatedDraft: string;
  finalRevision: string;
}

function idFor(index: number): string {
  return `edit_${index + 1}`;
}

function ruleScopeFor(areaId: string): RuleScope {
  if (areaId === "core" || areaId === "email" || areaId === "essay" || areaId === "plan" || areaId === "other") return areaId;
  return "other";
}

function classifyFactual(before: string, after: string): boolean {
  const numbersBefore = before.match(/\b\d+(?:[./-]\d+)*\b/g) ?? [];
  const numbersAfter = after.match(/\b\d+(?:[./-]\d+)*\b/g) ?? [];
  return numbersBefore.join("|") !== numbersAfter.join("|") ||
    (/\b(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i.test(before) &&
      /\b(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i.test(after) &&
      numbersBefore.join("|") === numbersAfter.join("|"));
}

export function classifyCorrection(before: string, after: string): ClassifiedEdit[] {
  const base = classifyChanges(before, after);
  const edits: ClassifiedEdit[] = base.map((change, index) => {
    const kind: ClassifiedEdit["kind"] = change.kind === "structural"
      ? "structural"
      : classifyFactual(change.before, change.after)
      ? "factual"
      : change.kind === "style" ? "voice" : change.kind;
    return { ...change, id: idFor(index), kind };
  });
  return edits;
}

export function createCorrectionRecord(input: CorrectionInput): CorrectionRecord {
  const edits = classifyCorrection(input.generatedDraft, input.finalRevision);
  const proposals = edits
    .filter((edit) => edit.kind !== "formatting" && edit.kind !== "spelling" && edit.kind !== "factual")
    .map((edit) => ({
      id: `proposal_${edit.id}`,
      instruction: edit.kind === "audience"
        ? "Record this audience adjustment for this task rather than making it universal."
        : `In ${input.areaId}, prefer: ${edit.after || "omit the phrase"}.`,
      editIds: [edit.id],
    }));
  const now = new Date().toISOString();
  return {
    id: `correction_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    ...input,
    edits,
    proposals,
    decisions: [],
    createdAt: now,
  };
}

export interface CorrectionDecisionResult {
  profile: Profile;
  record: CorrectionRecord;
}

export function decideCorrection(
  profile: Profile,
  record: CorrectionRecord,
  proposalIndex: number,
  decision: CorrectionDecision,
): CorrectionDecisionResult {
  const proposal = record.proposals[proposalIndex];
  if (!proposal) return { profile, record };
  if (record.decisions.some((item) => item.proposalId === proposal.id)) return { profile, record };

  const nextRecord: CorrectionRecord = {
    ...record,
    proposals: record.proposals.map((item) => item.id === proposal.id
      ? { ...item, rejected: decision === "wrong-interpretation" }
      : item),
    decisions: [...record.decisions, { proposalId: proposal.id, decision, createdAt: new Date().toISOString() }],
  };
  if (decision === "remember" || decision === "context-only") {
    const scope: RuleScope = decision === "context-only" ? ruleScopeFor(record.areaId) : "core";
    const next = proposeRule(profile, {
      instruction: proposal.instruction,
      evidence: [record.generatedDraft, record.finalRevision],
      scope,
      origin: "correction-pair",
    });
    return { profile: publishProfile(next, `Learned from correction: ${record.task}.`), record: nextRecord };
  }
  return { profile, record: nextRecord };
}

export function availableCorrectionProposals(record: CorrectionRecord): CorrectionProposal[] {
  return record.proposals.filter((proposal) => !proposal.rejected && !record.decisions.some((decision) => decision.proposalId === proposal.id && decision.decision === "wrong-interpretation"));
}
