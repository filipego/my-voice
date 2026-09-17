import { afterEach, beforeEach, describe, expect, it, vi, type MockedFunction } from "vitest";
import { initialProfile, proposeRule } from "../src/core/profileEngine";
import { createSource } from "../src/core/sourceImport";
import {
  deleteSourceEvidence,
  loadState,
  saveState,
} from "../src/core/storage";

type Invoke = MockedFunction<(command: string, args?: Record<string, unknown>) => Promise<unknown>>;

const state = () => {
  const source = createSource("My own paragraph about shipping slowly.", { title: "Note" });
  return { profile: { ...initialProfile }, sources: [source] };
};

describe("storage", () => {
  let invoke: Invoke;

  beforeEach(() => {
    localStorage.clear();
    invoke = vi.fn();
    vi.stubGlobal("__TAURI_INTERNALS__", { invoke });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("uses the native SQLite commands when Tauri is present", async () => {
    const saved = state();
    invoke
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(saved);

    await saveState(saved);
    expect(invoke).toHaveBeenCalledWith("save_voice_state", { state: saved });
    expect(await loadState()).toBe(saved);
  });

  it("falls back to localStorage when no native commands are installed", async () => {
    vi.unstubAllGlobals();
    const saved = state();
    await saveState(saved);
    expect(localStorage.getItem("my-voice-state-v1")).toContain("shipping slowly");
    expect(await loadState()).toEqual(saved);
  });

  it("keeps the browser profile usable when native persistence fails", async () => {
    invoke.mockRejectedValue(new Error("SQLite unavailable"));

    await expect(saveState(state())).rejects.toThrow("SQLite unavailable");
    expect(await loadState()).toEqual({ profile: initialProfile, sources: [] });
  });
});

describe("source deletion", () => {
  it("removes rules whose only evidence came from the deleted source", () => {
    const source = createSource("Open with the request.", { title: "Client note" });
    const keptSource = createSource("Use concrete examples.", { title: "Essay" });
    let profile = proposeRule({
      ...initialProfile,
    }, {
      instruction: "Open with the request.",
      evidence: ["Open with the request."],
      origin: "direct-instruction",
      scope: "email",
    });
    profile = proposeRule(profile, {
      instruction: "Use concrete examples.",
      evidence: ["Use concrete examples."],
      origin: "direct-instruction",
      scope: "essay",
    });
    profile = proposeRule(profile, {
      instruction: "Keep short sentences.",
      origin: "direct-instruction",
      scope: "core",
    });
    profile = {
      ...initialProfile,
      rules: profile.rules.map((rule, index) => ({
        ...rule,
        sourceIds: index === 0 ? [source.id] : index === 1 ? [keptSource.id] : [],
      })),
    };
    expect(deleteSourceEvidence({ profile, sources: [source, keptSource] }, source.id).profile.rules.map((rule) => rule.instruction)).toEqual(["Use concrete examples.", "Keep short sentences."]);
  });
});
