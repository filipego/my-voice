import type { Profile } from "./profileEngine";
import { initialProfile } from "./profileEngine";
import type { WritingSource } from "./sourceImport";

interface TauriInternals {
  invoke: (command: string, args?: Record<string, unknown>) => Promise<unknown>;
}

export interface AppState {
  profile: Profile;
  sources: WritingSource[];
}

export interface SkillPublication {
  path: string;
  backupPath: string | null;
  version: number;
}

const storageKey = "my-voice-state-v1";

function tauriInvoke(): TauriInternals["invoke"] | null {
  const internals = (globalThis as { __TAURI_INTERNALS__?: TauriInternals })
    .__TAURI_INTERNALS__;
  return typeof internals?.invoke === "function" ? internals.invoke : null;
}

export function normalizeAppState(input: unknown): AppState {
  const candidate = input && typeof input === "object"
    ? (input as Partial<AppState>)
    : {};
  const rawProfile = candidate.profile && typeof candidate.profile === "object"
    ? candidate.profile
    : {};

  if (
    candidate.profile &&
    Array.isArray(rawProfile.rules) &&
    Array.isArray(rawProfile.versions) &&
    typeof rawProfile.currentVersion === "number" &&
    Array.isArray(candidate.sources)
  ) {
    return candidate as AppState;
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
    sources: Array.isArray(candidate.sources) ? candidate.sources : [],
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
    } catch {
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
): Promise<SkillPublication> {
  const invoke = tauriInvoke();
  if (!invoke) throw new Error("Publishing requires the My Voice desktop app.");

  const result = (await invoke("publish_voice_skill", {
    request: { name, version, markdown },
  })) as { path: string; backup_path: string | null; version: number };

  return {
    path: result.path,
    backupPath: result.backup_path,
    version: result.version,
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
  };
}

export function deleteSourceEvidence(
  state: AppState,
  sourceId: string,
): AppState {
  const source = state.sources.find((item) => item.id === sourceId);
  if (!source) return state;

  return {
    profile: {
      ...state.profile,
      rules: state.profile.rules.filter(
        (rule) =>
          !rule.sourceIds?.includes(sourceId) &&
          !rule.evidence.some((excerpt) => source.paragraphs.includes(excerpt)),
      ),
    },
    sources: state.sources.filter((item) => item.id !== sourceId),
  };
}
