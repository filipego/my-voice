import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import Library from "../src/components/Library";
import TeachMyVoice from "../src/components/TeachMyVoice";
import TestAndUse from "../src/components/TestAndUse";
import type { VoiceProposal } from "../src/core/codexAdapter";
import { initialProfile, proposeRule, publishProfile } from "../src/core/profileEngine";
import { createSource } from "../src/core/sourceImport";
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

    fireEvent.click(
      within(proposalItems[1]).getByRole("button", {
        name: "Wrong interpretation",
      }),
    );
    expect(setState).toHaveBeenCalledTimes(2);
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
