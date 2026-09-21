import { useEffect, useMemo, useState } from "react";
import type { VoiceProposal } from "../core/codexAdapter";
import type { AppState } from "../core/storage";
import { classifyChanges } from "../core/diffEngine";
import { proposeRule } from "../core/profileEngine";
import type { RuleScope } from "../core/profileEngine";
import { createCorrectionRecord, decideCorrection, type CorrectionDecision, type CorrectionRecord } from "../core/correctionEngine";

interface Props {
  state: AppState;
  setState: (value: AppState) => void;
  runCodexAnalysis?: (request: { text: string; maxRules: number; signal?: AbortSignal }) => Promise<VoiceProposal[]>;
  onCancelAnalysis?: () => void;
  analysisSignal?: AbortSignal;
  initialPair?: {
    generatedDraft: string;
    finalRevision: string;
    task: string;
    audience: string;
    areaId: string;
    profileVersion: number;
  };
  onConsumeSeed?: () => void;
}

function correctionContextMatches(
  record: CorrectionRecord,
  context: { generatedDraft: string; finalRevision: string; task: string; audience: string; areaId: string },
): boolean {
  return record.generatedDraft === context.generatedDraft &&
    record.finalRevision === context.finalRevision &&
    record.task === (context.task.trim() || "correction") &&
    record.audience === (context.audience.trim() || "unspecified audience") &&
    record.areaId === context.areaId;
}

export default function TeachMyVoice({ state, setState, runCodexAnalysis, onCancelAnalysis, analysisSignal, initialPair, onConsumeSeed }: Props) {
  const [before, setBefore] = useState(initialPair?.generatedDraft ?? "");
  const [after, setAfter] = useState(initialPair?.finalRevision ?? "");
  const [codexProposals, setCodexProposals] = useState("");
  const [codexError, setCodexError] = useState<string | null>(null);
  const [codexStatus, setCodexStatus] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [scope, setScope] = useState<"core" | "email" | "essay" | "plan" | "other">((initialPair?.areaId as "core" | "email" | "essay" | "plan" | "other") ?? "email");
  const [task, setTask] = useState(initialPair?.task ?? "");
  const [audience, setAudience] = useState(initialPair?.audience ?? "");
  const [activeRecord, setActiveRecord] = useState<CorrectionRecord | null>(null);
  const changes = before && after ? classifyChanges(before, after) : [];
  useEffect(() => {
    if (!initialPair) return;
    setBefore(initialPair.generatedDraft);
    setAfter(initialPair.finalRevision);
    setTask(initialPair.task);
    setAudience(initialPair.audience);
    if (["core", "email", "essay", "plan", "other"].includes(initialPair.areaId)) setScope(initialPair.areaId as typeof scope);
    onConsumeSeed?.();
  }, [initialPair, onConsumeSeed]);
  const correctionContext = { generatedDraft: before, finalRevision: after, task, audience, areaId: scope };
  const draftRecord = useMemo(() => before && after ? createCorrectionRecord({
    task: task.trim() || "correction",
    audience: audience.trim() || "unspecified audience",
    areaId: scope,
    profileVersion: state.profile.currentVersion,
    generatedDraft: before,
    finalRevision: after,
  }) : null, [before, after, task, audience, scope, state.profile.currentVersion]);
  const persistedRecord = state.corrections?.find((record) => correctionContextMatches(record, correctionContext)) ?? null;
  const rejectedProposalIds = new Set(
    (state.corrections ?? [])
      .filter((record) => correctionContextMatches(record, correctionContext))
      .flatMap((record) => record.decisions.map((decision) => decision.proposalId)),
  );
  const proposals = (draftRecord?.proposals ?? []).filter((proposal) => !rejectedProposalIds.has(proposal.id));
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

  function decide(proposalId: string, action: CorrectionDecision) {
    const record = (activeRecord && correctionContextMatches(activeRecord, correctionContext)
      ? activeRecord
      : persistedRecord) ?? draftRecord;
    if (!record) return;
    const proposalIndex = record.proposals.findIndex((proposal) => proposal.id === proposalId);
    if (proposalIndex < 0) return;
    const result = decideCorrection(state.profile, record, proposalIndex, action);
    setActiveRecord(result.record);
    const corrections = [...(state.corrections ?? []).filter((item) => item.id !== result.record.id), result.record];
    setState({ ...state, profile: result.profile, corrections });
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
      const returned = await runCodexAnalysis({ text: approvedText, maxRules: 5, signal: analysisSignal });
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
      <label className="single-field">
        Scope
        <select value={scope} onChange={(event) => setScope(event.target.value as typeof scope)}>
          <option value="core">Core</option>
          <option value="email">Email</option>
          <option value="essay">Essay</option>
          <option value="plan">Plan</option>
          <option value="other">Other</option>
        </select>
      </label>
      <div className="teach-grid">
        <label>Task<input value={task} onChange={(event) => setTask(event.target.value)} /></label>
        <label>Audience<input value={audience} onChange={(event) => setAudience(event.target.value)} /></label>
      </div>

      <h2>Proposed lessons</h2>
      {changes.length === 0 && <p className="empty">No changes detected yet.</p>}
      <ul className="proposal-list">
        {proposals.map((proposal) => (
          <li key={proposal.id}>
            <p>{proposal.instruction}</p>
            <div className="action-row">
              <button type="button" onClick={() => decide(proposal.id, "remember")}>Remember this</button>
              <button
                type="button"
                className="chip"
                onClick={() => decide(proposal.id, "context-only")}
              >
                Only in this context
              </button>
              <button type="button" className="chip" onClick={() => decide(proposal.id, "just-this-time")}>Just this time</button>
              <button type="button" className="chip danger" onClick={() => decide(proposal.id, "wrong-interpretation")}>Wrong interpretation</button>
            </div>
          </li>
        ))}
      </ul>

      <h2>Codex proposals</h2>
      <div className="action-row">
        <button
          type="button"
          onClick={analyzeApprovedWriting}
          disabled={!runCodexAnalysis || isAnalyzing || !approvedText}
        >
          {isAnalyzing ? "Analyzing..." : "Analyze approved writing"}
        </button>
        {isAnalyzing && onCancelAnalysis && (
          <button type="button" className="chip" onClick={onCancelAnalysis}>
            Cancel analysis
          </button>
        )}
        {codexStatus && (
          <p role="status" className="status">
            {codexStatus}
          </p>
        )}
      </div>
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
