import type { Profile } from "./profileEngine";
import { initialProfile, publishProfile } from "./profileEngine";
import type { WritingSource } from "./sourceImport";
import type { CorrectionRecord } from "./correctionEngine";

interface TauriInternals {
  invoke: (command: string, args?: Record<string, unknown>) => Promise<unknown>;
}

export interface AppState {
  profile: Profile;
  sources: WritingSource[];
  corrections?: CorrectionRecord[];
}

export interface SkillPublication {
  path: string;
  backupPath: string | null;
  version: number;
  status?: "installed" | "pending-update" | "external-changes" | "needs-reload";
}

const storageKey = "my-voice-state-v1";

function tauriInvoke(): TauriInternals["invoke"] | null {
  const internals = (globalThis as { __TAURI_INTERNALS__?: TauriInternals })
    .__TAURI_INTERNALS__;
  return typeof internals?.invoke === "function" ? internals.invoke : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object";
}

function isUnsupportedStorageVersionError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message.startsWith("unsupported storage version:");
}

export function normalizeAppState(input: unknown): AppState {
  const candidate = isRecord(input) ? input : {};
  const rawProfile = isRecord(candidate.profile) ? candidate.profile : {};
  const sources = Array.isArray(candidate.sources) ? candidate.sources : [];
  const corrections = Array.isArray(candidate.corrections) ? candidate.corrections : undefined;

  if (
    Array.isArray(rawProfile.rules) &&
    Array.isArray(rawProfile.versions) &&
    typeof rawProfile.currentVersion === "number" &&
    Array.isArray(candidate.sources)
  ) {
    return {
      profile: {
        rules: rawProfile.rules,
        versions: rawProfile.versions,
        currentVersion: rawProfile.currentVersion,
      } as Profile,
      sources,
      ...(corrections ? { corrections } : {}),
    };
  }

  return {
    profile: {
      ...initialProfile,
      ...rawProfile,
      rules: Array.isArray(rawProfile.rules) ? rawProfile.rules : [],
      versions: Array.isArray(rawProfile.versions) ? rawProfile.versions : [],
      currentVersion: typeof rawProfile.currentVersion === "number"
        ? rawProfile.currentVersion
        : initialProfile.currentVersion,
    },
    sources,
    ...(corrections ? { corrections } : {}),
  };
}

function parseState(raw: string): AppState {
  try {
    return normalizeAppState(JSON.parse(raw));
  } catch {
    return normalizeAppState(null);
  }
}

export async function loadState(): Promise<AppState> {
  const invoke = tauriInvoke();
  if (invoke) {
    try {
      return normalizeAppState(await invoke("load_voice_state"));
    } catch (error) {
      if (isUnsupportedStorageVersionError(error)) throw error;
      return normalizeAppState(null);
    }
  }

  const raw = localStorage.getItem(storageKey);
  return raw ? parseState(raw) : normalizeAppState(null);
}

export async function saveState(state: AppState): Promise<void> {
  const invoke = tauriInvoke();
  if (invoke) {
    await invoke("save_voice_state", { state });
    return;
  }

  localStorage.setItem(storageKey, JSON.stringify(state));
}

export async function publishVoiceSkill(
  name: string,
  version: number,
  markdown: string,
  files: Record<string, string> = { "SKILL.md": markdown },
  manifest?: unknown,
): Promise<SkillPublication> {
  const invoke = tauriInvoke();
  if (!invoke) throw new Error("Publishing requires the My Voice desktop app.");

  const result = (await invoke("publish_voice_skill", {
    request: { name, version, markdown, files, manifest },
  })) as { path: string; backup_path: string | null; version: number };

  return {
    path: result.path,
    backupPath: result.backup_path,
    version: result.version,
    status: (result as { status?: SkillPublication["status"] }).status,
  };
}

export async function restoreVoiceSkill(
  path: string,
  backupPath: string | null,
): Promise<SkillPublication> {
  const invoke = tauriInvoke();
  if (!invoke) throw new Error("Restoring requires the My Voice desktop app.");

  const result = (await invoke("restore_voice_skill", {
    request: { path, backup_path: backupPath },
  })) as { path: string; backup_path: string | null; version: number };

  return {
    path: result.path,
    backupPath: result.backup_path,
    version: result.version,
    status: (result as { status?: SkillPublication["status"] }).status,
  };
}

export function deleteSourceEvidence(
  state: AppState,
  sourceId: string,
): AppState {
  const source = state.sources.find((item) => item.id === sourceId);
  if (!source) return state;

  const rules = state.profile.rules.flatMap((rule) => {
    const sourceIds = (rule.sourceIds ?? []).filter((id) => id !== sourceId);
    const evidence = rule.evidence.filter((item) => typeof item !== "string" ? item.sourceId !== sourceId : !source.paragraphs.includes(item));
    const referencesSource = rule.sourceIds?.includes(sourceId) || rule.evidence.some((item) => typeof item !== "string" ? item.sourceId === sourceId : source.paragraphs.includes(item));
    if (!referencesSource) return [rule];
    if (sourceIds.length === 0 && evidence.length === 0) return [];
    return [{ ...rule, sourceIds: sourceIds.length ? sourceIds : undefined, evidence, updatedAt: new Date().toISOString() }];
  });
  const versioned = publishProfile(state.profile, `Deleted source ${source.title}.`);
  return {
    profile: {
      ...versioned,
      rules,
    },
    sources: state.sources.filter((item) => item.id !== sourceId),
  };
}

export function sourceEvidenceImpact(state: AppState, sourceId: string): number {
  const source = state.sources.find((item) => item.id === sourceId);
  if (!source) return 0;
  return state.profile.rules.filter((rule) =>
    Boolean(
      (rule.sourceIds?.includes(sourceId) || rule.evidence.some((evidence) =>
        typeof evidence !== "string" ? evidence.sourceId === sourceId : source.paragraphs.includes(evidence),
      )) &&
      (rule.sourceIds ?? []).filter((id) => id !== sourceId).length === 0 &&
      rule.evidence.filter((evidence) =>
        typeof evidence !== "string" ? evidence.sourceId !== sourceId : !source.paragraphs.includes(evidence),
      ).length === 0,
    ),
  ).length;
}
