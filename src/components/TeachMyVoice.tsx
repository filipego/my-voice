import { useMemo, useState } from "react";
import type { VoiceProposal } from "../core/codexAdapter";
import type { AppState } from "../core/storage";
import { classifyChanges, proposeCorrectionRules } from "../core/diffEngine";
import { proposeRule } from "../core/profileEngine";
import type { RuleScope } from "../core/profileEngine";

interface Props {
  state: AppState;
  setState: (value: AppState) => void;
  runCodexAnalysis?: (request: { text: string; maxRules: number }) => Promise<VoiceProposal[]>;
}

export default function TeachMyVoice({ state, setState, runCodexAnalysis }: Props) {
  const [before, setBefore] = useState("");
  const [after, setAfter] = useState("");
  const [codexProposals, setCodexProposals] = useState("");
  const [codexError, setCodexError] = useState<string | null>(null);
  const [codexStatus, setCodexStatus] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [scope, setScope] = useState<"core" | "email" | "essay" | "plan" | "other">("email");
  const changes = before && after ? classifyChanges(before, after) : [];
  const proposals = proposeCorrectionRules(changes, scope);
  const approvedText = useMemo(
    () =>
      state.sources
        .filter((source) => source.status === "approved")
        .flatMap((source) => source.paragraphs)
        .map((paragraph) => paragraph.trim())
        .filter(Boolean)
        .join("\n\n"),
    [state.sources],
  );

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

  async function analyzeApprovedWriting() {
    if (!runCodexAnalysis) return;

    setIsAnalyzing(true);
    setCodexError(null);
    setCodexStatus("Running Codex analysis...");

    try {
      const returned = await runCodexAnalysis({ text: approvedText, maxRules: 5 });
      const nextProfile = returned.reduce(
        (profile, proposal) =>
          proposeRule(profile, {
            instruction: proposal.instruction,
            evidence: proposal.evidence,
            scope: proposal.scope,
            origin: "direct-instruction",
          }),
        state.profile,
      );

      setState({ ...state, profile: nextProfile });
      setCodexStatus("Codex analysis finished.");
    } catch (error) {
      setCodexStatus(null);
      setCodexError(error instanceof Error ? error.message : "Codex analysis failed.");
    } finally {
      setIsAnalyzing(false);
    }
  }

  return (
    <section className="pane" aria-labelledby="teach-heading">
      <header className="pane-header">
        <div>
          <h2 id="teach-heading">Teach</h2>
          <p>Put a draft beside your revision, then keep only the lessons you want.</p>
        </div>
      </header>

      <div className="composer">
        <div className="composer-stack">
          <div className="split">
            <label className="field">
              AI draft
              <textarea value={before} onChange={(event) => setBefore(event.target.value)} rows={10} />
            </label>
            <label className="field">
              Your final
              <textarea value={after} onChange={(event) => setAfter(event.target.value)} rows={10} />
            </label>
          </div>
          <label className="field field-narrow">
            Scope
            <select value={scope} onChange={(event) => setScope(event.target.value as typeof scope)}>
              <option value="core">Core</option>
              <option value="email">Email</option>
              <option value="essay">Essay</option>
              <option value="plan">Plan</option>
              <option value="other">Other</option>
            </select>
          </label>
        </div>
      </div>

      <section className="section-block" aria-labelledby="lessons-heading">
        <h3 id="lessons-heading">Proposed lessons</h3>
        {changes.length === 0 && <p className="empty">No changes detected yet.</p>}
        <ul className="item-list">
          {proposals.map((proposal, index) => (
            <li key={proposal} className="item-card">
              <p className="rule-text">{proposal}</p>
              <div className="action-row">
                <button type="button" className="button" onClick={() => remember(index, "remember")}>
                  Remember this
                </button>
                <button
                  type="button"
                  className="button button-quiet"
                  onClick={() => remember(index, "context-only")}
                >
                  Only in this context
                </button>
                <button type="button" className="button button-quiet" disabled>
                  Wrong interpretation
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="section-block" aria-labelledby="codex-heading">
        <h3 id="codex-heading">Add from Codex</h3>
        <div className="composer">
          <div className="composer-stack">
            <div className="action-row">
              <button
                type="button"
                className="button"
                onClick={analyzeApprovedWriting}
                disabled={!runCodexAnalysis || isAnalyzing || !approvedText}
              >
                {isAnalyzing ? "Analyzing..." : "Analyze approved writing"}
              </button>
              {codexStatus && (
                <p role="status" className="inline-status">
                  {codexStatus}
                </p>
              )}
            </div>
            <label className="field">
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
            <div className="action-row">
              <button type="button" className="button" onClick={addCodexProposals}>
                Add Codex proposals
              </button>
            </div>
          </div>
        </div>
      </section>
    </section>
  );
}
