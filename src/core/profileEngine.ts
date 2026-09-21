export type RuleScope = "core" | "email" | "essay" | "plan" | "other";
export type RuleState = "proposed" | "approved" | "rejected" | "locked" | "superseded";
export type ProposalOrigin = "direct-instruction" | "correction-pair" | "writing-sample";

export interface EvidenceRecord {
  sourceId: string;
  paragraphId: string;
  excerpt: string;
}

export interface VoiceRule {
  id: string;
  instruction: string;
  evidence: Array<EvidenceRecord | string>;
  sourceIds?: string[];
  scope: RuleScope;
  state: RuleState;
  origin: ProposalOrigin;
  confidence: "limited evidence" | "supported by several examples" | "explicit user instruction";
  createdAt: string;
  updatedAt: string;
}

export interface ProfileVersion {
  version: number;
  createdAt: string;
  summary: string;
  rules: VoiceRule[];
}

export interface Profile {
  rules: VoiceRule[];
  versions: ProfileVersion[];
  currentVersion: number;
}

export const initialProfile: Profile = {
  rules: [],
  versions: [],
  currentVersion: 0,
};

function stableId(prefix: string, value: string, existing: Set<string>): string {
  const base = `${prefix}_${value.slice(0, 16).replace(/[^a-zA-Z0-9]/g, "")}`;
  let id = base;
  let suffix = 2;
  while (existing.has(id)) id = `${base}_${suffix++}`;
  return id;
}

function snapshot(profile: Profile, summary: string): ProfileVersion {
  return {
    version: profile.currentVersion + 1,
    createdAt: new Date().toISOString(),
    summary,
    rules: profile.rules.map((rule) => ({ ...rule })),
  };
}

export function proposeRule(
  profile: Profile,
  proposal: {
    instruction: string;
    evidence?: Array<EvidenceRecord | string>;
    scope?: RuleScope;
    origin: ProposalOrigin;
    confidence?: VoiceRule["confidence"];
  },
): Profile {
  const now = new Date().toISOString();
  const next: Profile = {
    ...profile,
    rules: [
      ...profile.rules,
      {
        id: stableId("rule", proposal.instruction + proposal.origin + now, new Set(profile.rules.map((rule) => rule.id))),
        instruction: proposal.instruction,
        evidence: proposal.evidence ?? [],
        scope: proposal.scope ?? "core",
        state: "proposed",
        origin: proposal.origin,
        confidence: proposal.confidence ?? (proposal.origin === "direct-instruction"
          ? "explicit user instruction"
          : "limited evidence"),
        createdAt: now,
        updatedAt: now,
      },
    ],
  };
  return next;
}

export function editRule(profile: Profile, ruleId: string, instruction: string): Profile {
  const rule = profile.rules.find((item) => item.id === ruleId);
  if (!rule || rule.state === "locked" || !instruction.trim()) return profile;
  const now = new Date().toISOString();
  return { ...profile, rules: profile.rules.map((item) => item.id === ruleId ? { ...item, instruction: instruction.trim(), updatedAt: now } : item) };
}

export function supersedeRule(
  profile: Profile,
  ruleId: string,
  proposal: Parameters<typeof proposeRule>[1],
): Profile {
  const rule = profile.rules.find((item) => item.id === ruleId);
  if (!rule || rule.state === "locked") return profile;
  const now = new Date().toISOString();
  const superseded = { ...profile, rules: profile.rules.map((item) => item.id === ruleId ? { ...item, state: "superseded" as const, updatedAt: now } : item) };
  return proposeRule(superseded, proposal);
}

export function resolveContradiction(profile: Profile, keepRuleId: string, rejectRuleIds: string[]): Profile {
  const now = new Date().toISOString();
  return { ...profile, rules: profile.rules.map((rule) => rejectRuleIds.includes(rule.id) && rule.id !== keepRuleId && rule.state !== "locked" ? { ...rule, state: "rejected" as const, updatedAt: now } : rule) };
}

export function setRuleState(
  profile: Profile,
  ruleId: string,
  state: Exclude<RuleState, "proposed">,
): Profile {
  const now = new Date().toISOString();
  const current = profile.rules.find((rule) => rule.id === ruleId);
  if (!current || current.state === "locked") return profile;
  return {
    ...profile,
    rules: profile.rules.map((rule) =>
      rule.id === ruleId ? { ...rule, state, updatedAt: now } : rule,
    ),
  };
}

export function publishProfile(profile: Profile, summary: string): Profile {
  const version = snapshot(profile, summary);
  return {
    ...profile,
    versions: [...profile.versions, version],
    currentVersion: version.version,
  };
}

export function rollbackToVersion(profile: Profile, version: number): Profile {
  const target = profile.versions.find((item) => item.version === version);
  if (!target) {
    throw new Error(`Profile version ${version} does not exist.`);
  }

  const restored = publishProfile(
    { ...profile, rules: target.rules.map((rule) => ({ ...rule })) },
    `Restored profile from version ${version}.`,
  );
  return restored;
}
