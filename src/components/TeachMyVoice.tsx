import { useState } from "react";
import type { AppState } from "../core/storage";
import { classifyChanges, proposeCorrectionRules } from "../core/diffEngine";
import { proposeRule } from "../core/profileEngine";
import type { RuleScope } from "../core/profileEngine";

interface Props {
  state: AppState;
  setState: (value: AppState) => void;
}

export default function TeachMyVoice({ state, setState }: Props) {
  const [before, setBefore] = useState("");
  const [after, setAfter] = useState("");
  const [codexProposals, setCodexProposals] = useState("");
  const [codexError, setCodexError] = useState<string | null>(null);
  const [scope, setScope] = useState<"core" | "email" | "essay" | "plan" | "other">("email");
  const changes = before && after ? classifyChanges(before, after) : [];
  const proposals = proposeCorrectionRules(changes, scope);

  function remember(index: number, action: "remember" | "context-only") {
    const proposal = proposals[index];
    const isAudience = action === "context-only";
    const instruction = isAudience
      ? proposal
      : proposal.replace(" context,", " context:");
    setState({
      ...state,
      profile: proposeRule(state.profile, {
        instruction,
        evidence: [before, after],
        scope,
        origin: "correction-pair",
      }),
    });
  }

  function addCodexProposals() {
    let parsed: unknown;

    try {
      parsed = JSON.parse(codexProposals);
    } catch {
      setCodexError("Enter valid JSON.");
      return;
    }

    if (!Array.isArray(parsed) || parsed.length === 0) {
      setCodexError("Enter a non-empty array of proposals.");
      return;
    }

    const invalid = parsed.some(
      (item) =>
        typeof item !== "object" ||
        item === null ||
        typeof (item as { instruction?: unknown }).instruction !== "string" ||
        (item as { instruction: string }).instruction.trim() === "",
    );

    if (invalid) {
      setCodexError("Every proposal needs a non-empty instruction.");
      return;
    }

    setCodexError(null);
    setCodexProposals("");
    setState({
      ...state,
      profile: (parsed as Array<{
        instruction: string;
        evidence?: string[];
        scope?: RuleScope;
      }>).reduce(
        (profile, item) =>
          proposeRule(profile, {
            instruction: item.instruction.trim(),
            evidence: item.evidence ?? [],
            scope: item.scope ?? "core",
            origin: "direct-instruction",
          }),
        state.profile,
      ),
    });
  }

  return (
    <section className="panel" aria-labelledby="teach-heading">
      <h2 id="teach-heading">Teach from a correction</h2>
      <div className="teach-grid">
        <label>
          AI draft
          <textarea value={before} onChange={(event) => setBefore(event.target.value)} rows={10} />
        </label>
        <label>
          Your final
          <textarea value={after} onChange={(event) => setAfter(event.target.value)} rows={10} />
        </label>
      </div>
      <label>
        Scope
        <select value={scope} onChange={(event) => setScope(event.target.value as typeof scope)}>
          <option value="core">Core</option>
          <option value="email">Email</option>
          <option value="essay">Essay</option>
          <option value="plan">Plan</option>
          <option value="other">Other</option>
        </select>
      </label>

      <h2>Proposed lessons</h2>
      {changes.length === 0 && <p className="empty">No changes detected yet.</p>}
      <ul className="proposal-list">
        {proposals.map((proposal, index) => (
          <li key={proposal}>
            <p>{proposal}</p>
            <div className="action-row">
              <button type="button" onClick={() => remember(index, "remember")}>Remember this</button>
              <button
                type="button"
                className="chip"
                onClick={() => remember(index, "context-only")}
              >
                Only in this context
              </button>
              <button type="button" className="chip danger" disabled>Wrong interpretation</button>
            </div>
          </li>
        ))}
      </ul>

      <h2>Codex proposals</h2>
      <label>
        Codex proposals
        <textarea
          value={codexProposals}
          onChange={(event) => {
            setCodexProposals(event.target.value);
            setCodexError(null);
          }}
          rows={6}
        />
      </label>
      {codexError && (
        <p role="alert" className="error">
          {codexError}
        </p>
      )}
      <button type="button" onClick={addCodexProposals}>
        Add Codex proposals
      </button>
    </section>
  );
}
