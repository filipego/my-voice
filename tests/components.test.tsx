import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import Library from "../src/components/Library";
import MyVoice from "../src/components/MyVoice";
import TeachMyVoice from "../src/components/TeachMyVoice";
import TestAndUse from "../src/components/TestAndUse";
import type { VoiceProposal } from "../src/core/codexAdapter";
import { initialProfile, proposeRule, publishProfile } from "../src/core/profileEngine";
import { createSource } from "../src/core/sourceImport";
import * as sourceImport from "../src/core/sourceImport";
import type { AppState } from "../src/core/storage";

afterEach(() => {
  document.body.innerHTML = "";
});

function appState(): AppState {
  const source = createSource("Write the request in the first line.", {
    title: "Client note",
    format: "email",
  });
  let profile = proposeRule(initialProfile, {
    instruction: "Open with the request.",
    scope: "email",
    origin: "direct-instruction",
  });
  profile = publishProfile(profile, "First version");
  profile = proposeRule(profile, {
    instruction: "Use concrete examples.",
    scope: "essay",
    origin: "writing-sample",
  });

  return { profile, sources: [{ ...source, status: "approved" }] };
}

describe("Library source deletion", () => {
  it("keeps the source until deletion is confirmed", () => {
    const state = appState();
    const setState = vi.fn();
    render(<Library state={state} setState={setState} />);

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(setState).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Cancel delete" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete source" }));

    expect(setState).toHaveBeenCalledTimes(1);
    expect(setState.mock.calls[0][0].sources).toHaveLength(0);
  });

  it("shows affected rules before confirming source deletion", () => {
    const state = appState();
    const source = state.sources[0];
    const next = { ...state, profile: { ...state.profile, rules: state.profile.rules.map((rule) => ({ ...rule, sourceIds: [source.id] })) } };
    const setState = vi.fn();
    render(<Library state={next} setState={setState} />);
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(screen.getByText(/will remove .* rule/i)).toBeInTheDocument();
  });
});

describe("My Voice rule review", () => {
  it("edits a rule and saves a profile version", () => {
    const state = appState();
    const setState = vi.fn();
    render(<MyVoice state={state} setState={setState} />);
    fireEvent.click(screen.getAllByRole("button", { name: "Edit" })[0]);
    fireEvent.change(screen.getByRole("textbox", { name: "Edit rule" }), { target: { value: "State the request plainly." } });
    fireEvent.click(screen.getByRole("button", { name: "Save rule" }));
    expect(setState.mock.calls[0][0].profile.rules[0].instruction).toBe("State the request plainly.");
    expect(setState.mock.calls[0][0].profile.versions).toHaveLength(2);
  });
});

describe("Library reviewed imports", () => {
  it("reports duplicate checks clearly and exposes file review", async () => {
    const state = appState();
    const setState = vi.fn();
    render(<Library state={state} setState={setState} />);
    fireEvent.change(screen.getByLabelText("Text"), { target: { value: "Write the request in the first line." } });
    fireEvent.click(screen.getByRole("button", { name: "Check duplicate" }));
    expect(screen.getByRole("status")).toHaveTextContent(/duplicate found/i);

    const input = screen.getByLabelText(/Writing file/);
    const file = new File(["A paragraph.\n\nAnother paragraph."], "sample.txt", { type: "text/plain" });
    fireEvent.change(input, { target: { files: [file] } });
    expect(await screen.findByRole("region", { name: "Import preview" })).toBeInTheDocument();
    expect(screen.getByText(/Include paragraph 1/)).toBeInTheDocument();
    expect(screen.getByText("A paragraph.")).toBeInTheDocument();
    expect(screen.getByText("Another paragraph.")).toBeInTheDocument();
  });

  it("persists an excluded paragraph and rejects an empty selection", async () => {
    const state = appState();
    const setState = vi.fn();
    render(<Library state={{ ...state, sources: [] }} setState={setState} />);
    const input = screen.getByLabelText(/Writing file/);
    fireEvent.change(input, { target: { files: [new File(["Keep.\n\nSkip."], "review.txt")] } });
    await screen.findByRole("region", { name: "Import preview" });
    fireEvent.click(screen.getByLabelText("Include paragraph 2"));
    fireEvent.click(screen.getByRole("button", { name: "Import file" }));
    expect(setState).toHaveBeenCalledTimes(1);
    expect(setState.mock.calls[0][0].sources[0].paragraphs).toEqual(["Keep."]);
    expect(setState.mock.calls[0][0].sources[0].paragraphDecisions[1].decision).toBe("excluded");

    setState.mockClear();
    fireEvent.change(input, { target: { files: [new File(["Only."], "empty-selection.txt")] } });
    await screen.findByRole("region", { name: "Import preview" });
    fireEvent.click(screen.getByLabelText("Include paragraph 1"));
    fireEvent.click(screen.getByRole("button", { name: "Import file" }));
    expect(screen.getByRole("alert")).toHaveTextContent(/include at least one paragraph/i);
    expect(setState).not.toHaveBeenCalled();
  });

  it("replaces only permitted metadata for a canonical duplicate", async () => {
    const original = createSource("Same words.", { title: "Old title" });
    const state = { ...appState(), sources: [{ ...original, status: "approved" as const, createdAt: "2020-01-01T00:00:00.000Z", paragraphDecisions: [{ ...original.paragraphDecisions[0], decision: "excluded" as const }] }] };
    const setState = vi.fn();
    render(<Library state={state} setState={setState} />);
    fireEvent.click(screen.getByLabelText("Replace duplicate metadata"));
    fireEvent.change(screen.getByLabelText(/Writing file/), { target: { files: [new File(["SAME WORDS."], "same.txt")] } });
    await screen.findByRole("region", { name: "Import preview" });
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "New title" } });
    fireEvent.click(screen.getByRole("button", { name: "Import file" }));
    const replaced = setState.mock.calls[0][0].sources[0];
    expect(replaced.title).toBe("New title");
    expect(replaced.status).toBe("approved");
    expect(replaced.createdAt).toBe("2020-01-01T00:00:00.000Z");
    expect(replaced.paragraphDecisions[0].decision).toBe("excluded");
  });

  it("keeps excluded paragraphs part of duplicate identity", async () => {
    const setState = vi.fn();
    render(<Library state={{ ...appState(), sources: [] }} setState={setState} />);
    const input = screen.getByLabelText(/Writing file/);
    fireEvent.change(input, { target: { files: [new File(["Keep.\n\nExclude."], "first.txt")] } });
    await screen.findByRole("region", { name: "Import preview" });
    fireEvent.click(screen.getByLabelText("Include paragraph 2"));
    fireEvent.click(screen.getByRole("button", { name: "Import file" }));
    const first = setState.mock.calls[0][0].sources[0];
    setState.mockClear();

    document.body.innerHTML = "";
    render(<Library state={{ ...appState(), sources: [first] }} setState={setState} />);
    fireEvent.change(screen.getByLabelText(/Writing file/), { target: { files: [new File(["KEEP.\n\nEXCLUDE."], "second.txt")] } });
    await screen.findByRole("region", { name: "Import preview" });
    fireEvent.click(screen.getByRole("button", { name: "Import file" }));
    expect(screen.getByRole("alert")).toHaveTextContent(/already been imported/i);
    expect(setState).not.toHaveBeenCalled();

    fireEvent.click(screen.getByLabelText("Replace duplicate metadata"));
    fireEvent.click(screen.getByRole("button", { name: "Import file" }));
    const replaced = setState.mock.calls[0][0].sources;
    expect(replaced).toHaveLength(1);
    expect(replaced[0].id).toBe(first.id);
    expect(replaced[0].status).toBe(first.status);
    expect(replaced[0].createdAt).toBe(first.createdAt);
    expect(replaced[0].paragraphDecisions).toEqual(first.paragraphDecisions);
  });

  it("ignores stale file extraction results", async () => {
    const deferred = new Map<string, { resolve: (value: sourceImport.ImportPreview) => void }>();
    vi.spyOn(sourceImport, "importWritingFile").mockImplementation((file) => new Promise((resolve) => { deferred.set(file.name, { resolve }); }));
    const setState = vi.fn();
    render(<Library state={{ ...appState(), sources: [] }} setState={setState} />);
    const input = screen.getByLabelText(/Writing file/);
    fireEvent.change(input, { target: { files: [new File(["old"], "old.txt")] } });
    fireEvent.change(input, { target: { files: [new File(["new"], "new.txt")] } });
    expect(screen.queryByRole("region", { name: "Import preview" })).not.toBeInTheDocument();
    deferred.get("new.txt")?.resolve({ filename: "new.txt", type: "txt", size: 3, hash: "new", warnings: [], paragraphs: [{ id: "p_new", text: "Newest.", decision: "included" }] });
    expect(await screen.findByText("Newest.")).toBeInTheDocument();
    deferred.get("old.txt")?.resolve({ filename: "old.txt", type: "txt", size: 3, hash: "old", warnings: [], paragraphs: [{ id: "p_old", text: "Oldest.", decision: "included" }] });
    expect(screen.queryByText("Oldest.")).not.toBeInTheDocument();
  });
});

describe("Teach correction actions", () => {
  it("proposes style and audience lessons with distinct outcomes", () => {
    const setState = vi.fn();
    render(<TeachMyVoice state={appState()} setState={setState} />);

    fireEvent.change(screen.getByLabelText("AI draft"), {
      target: { value: "I am writing to ask whether we can meet." },
    });
    fireEvent.change(screen.getByLabelText("Your final"), {
      target: { value: "Can we meet?" },
    });

    const proposalItems = screen.getAllByRole("listitem");
    expect(proposalItems).toHaveLength(2);

    fireEvent.click(
      within(proposalItems[0]).getByRole("button", { name: "Remember this" }),
    );
    expect(setState).toHaveBeenCalledTimes(1);
    expect(setState.mock.calls[0][0].profile.rules[0].scope).toBe("email");
    expect(setState.mock.calls[0][0].profile.rules[0].state).toBe("proposed");

    fireEvent.click(
      within(proposalItems[1]).getByRole("button", {
        name: "Only in this context",
      }),
    );
    expect(setState).toHaveBeenCalledTimes(2);
    expect(setState.mock.calls[1][0].profile.rules[2].instruction).toContain(
      "Record this audience adjustment",
    );
    expect(setState.mock.calls[1][0].profile.rules[2].scope).toBe("email");

    document.body.innerHTML = "";
    const rejectedSetState = vi.fn();
    render(<TeachMyVoice state={appState()} setState={rejectedSetState} />);
    fireEvent.change(screen.getByLabelText("AI draft"), {
      target: { value: "I am writing to ask whether we can meet." },
    });
    fireEvent.change(screen.getByLabelText("Your final"), {
      target: { value: "Can we meet?" },
    });
    const rejectedItems = screen.getAllByRole("listitem");
    fireEvent.click(within(rejectedItems[0]).getByRole("button", { name: "Wrong interpretation" }));
    expect(rejectedSetState).toHaveBeenCalledTimes(1);
    expect(rejectedSetState.mock.calls[0][0].profile.rules).toHaveLength(2);
    expect(rejectedSetState.mock.calls[0][0].corrections[0].decisions[0].decision).toBe("wrong-interpretation");
  });
});

describe("Teach Codex proposals", () => {
  it("runs native analysis and adds returned proposals for review", async () => {
    const setState = vi.fn();
    const runCodexAnalysis = vi.fn().mockResolvedValue([
      { instruction: "Open with the request.", evidence: ["Can we meet?"], scope: "email" },
    ] satisfies VoiceProposal[]);
    render(<TeachMyVoice state={appState()} setState={setState} runCodexAnalysis={runCodexAnalysis} />);

    fireEvent.click(screen.getByRole("button", { name: "Analyze approved writing" }));

    expect(await screen.findByRole("status")).toHaveTextContent(
      "Codex analysis finished.",
    );
    expect(runCodexAnalysis).toHaveBeenCalledTimes(1);
    expect(setState).toHaveBeenCalledTimes(1);
    const nextRule = setState.mock.calls[0][0].profile.rules[2];
    expect(nextRule.instruction).toBe("Open with the request.");
    expect(nextRule.scope).toBe("email");
    expect(nextRule.state).toBe("proposed");
    expect(nextRule.origin).toBe("direct-instruction");
  });

  it("reports native-analysis failure without changing state", async () => {
    const setState = vi.fn();
    const runCodexAnalysis = vi.fn().mockRejectedValue(new Error("Codex analysis failed."));
    render(<TeachMyVoice state={appState()} setState={setState} runCodexAnalysis={runCodexAnalysis} />);

    fireEvent.click(screen.getByRole("button", { name: "Analyze approved writing" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Codex analysis failed.");
    expect(setState).not.toHaveBeenCalled();
  });

  it("exposes cancellation while analysis is running without changing the profile", async () => {
    const setState = vi.fn();
    let resolve: ((value: VoiceProposal[]) => void) | undefined;
    const runCodexAnalysis = vi.fn().mockImplementation(() => new Promise<VoiceProposal[]>((done) => { resolve = done; }));
    const onCancelAnalysis = vi.fn();
    render(<TeachMyVoice state={appState()} setState={setState} runCodexAnalysis={runCodexAnalysis} onCancelAnalysis={onCancelAnalysis} />);
    fireEvent.click(screen.getByRole("button", { name: "Analyze approved writing" }));
    fireEvent.click(await screen.findByRole("button", { name: "Cancel analysis" }));
    expect(onCancelAnalysis).toHaveBeenCalledTimes(1);
    expect(setState).not.toHaveBeenCalled();
    resolve?.([]);
  });

  it("accepts valid Codex proposal JSON as proposed rules", () => {
    const setState = vi.fn();
    render(<TeachMyVoice state={appState()} setState={setState} />);

    fireEvent.change(screen.getByLabelText("Codex proposals"), {
      target: {
        value: JSON.stringify([
          { instruction: "Use short sentences.", evidence: ["short excerpt"], scope: "core" },
        ]),
      },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add Codex proposals" }));

    expect(setState).toHaveBeenCalledTimes(1);
    const nextRule = setState.mock.calls[0][0].profile.rules[2];
    expect(nextRule.instruction).toBe("Use short sentences.");
    expect(nextRule.scope).toBe("core");
    expect(nextRule.state).toBe("proposed");
    expect(nextRule.origin).toBe("direct-instruction");
  });

  it("rejects malformed Codex proposal JSON without changing state", () => {
    const setState = vi.fn();
    render(<TeachMyVoice state={appState()} setState={setState} />);

    fireEvent.change(screen.getByLabelText("Codex proposals"), {
      target: { value: "not json" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add Codex proposals" }));

    expect(setState).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });
});

describe("App save after load", () => {
  it("does not save the initial state before restored state arrives", async () => {
    vi.resetModules();
    const saveState = vi.fn();
    const loadState = vi.fn().mockResolvedValue(appState());
    vi.doMock("../src/core/storage", () => ({
      loadState,
      saveState,
    }));
    const { default: MockedApp } = await import("../src/App");

    render(<MockedApp />);
    await screen.findByText(/1 sources/);

    expect(loadState).toHaveBeenCalledTimes(1);
    expect(saveState).not.toHaveBeenCalled();
  });
});

describe("Test and Use rollback", () => {
  it("calls the app state setter with the restored profile", () => {
    const state = appState();
    const setState = vi.fn();
    render(<TestAndUse state={state} setState={setState} />);

    fireEvent.click(screen.getByRole("button", { name: "Roll back" }));

    expect(setState).toHaveBeenCalledTimes(1);
    const [nextState] = setState.mock.calls[0];
    expect(nextState.profile.currentVersion).toBe(2);
    expect(nextState.profile.rules).toHaveLength(1);
    expect(nextState.profile.rules[0].instruction).toBe("Open with the request.");
  });
});
