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

const storageKey = "my-voice-state-v1";

function tauriInvoke(): TauriInternals["invoke"] | null {
  const internals = (globalThis as { __TAURI_INTERNALS__?: TauriInternals })
    .__TAURI_INTERNALS__;
  return typeof internals?.invoke === "function" ? internals.invoke : null;
}

function parseState(raw: string): AppState {
  try {
    const parsed = JSON.parse(raw) as Partial<AppState>;
    return {
      profile: parsed.profile ?? initialProfile,
      sources: parsed.sources ?? [],
    };
  } catch {
    return { profile: initialProfile, sources: [] };
  }
}

export async function loadState(): Promise<AppState> {
  const invoke = tauriInvoke();
  if (invoke) {
    try {
      return (await invoke("load_voice_state")) as AppState;
    } catch {
      return { profile: initialProfile, sources: [] };
    }
  }

  const raw = localStorage.getItem(storageKey);
  return raw ? parseState(raw) : { profile: initialProfile, sources: [] };
}

export async function saveState(state: AppState): Promise<void> {
  const invoke = tauriInvoke();
  if (invoke) {
    await invoke("save_voice_state", { state });
    return;
  }

  localStorage.setItem(storageKey, JSON.stringify(state));
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
