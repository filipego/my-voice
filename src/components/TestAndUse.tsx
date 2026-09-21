import { useMemo, useState } from "react";
import type { AppState } from "../core/storage";
import { publishVoiceSkill, restoreVoiceSkill } from "../core/storage";
import { compileSkillPackage } from "../core/skillCompiler";
import { rollbackToVersion } from "../core/profileEngine";
import { generateDraft as generateDraftWithCodex, type GeneratedDraft } from "../core/codexAdapter";

export interface CorrectionPairTransfer {
  generatedDraft: string;
  finalRevision: string;
  task: string;
  audience: string;
  areaId: string;
  profileVersion: number;
}

interface Props {
  state: AppState;
  setState: (value: AppState) => void;
  generateDraft?: typeof generateDraftWithCodex;
  onTransferToTeach?: (pair: CorrectionPairTransfer) => void;
}

export default function TestAndUse({ state, setState, generateDraft = generateDraftWithCodex, onTransferToTeach }: Props) {
  const [prompt, setPrompt] = useState("");
  const [audience, setAudience] = useState("");
  const [areaId, setAreaId] = useState("email");
  const [editedDraft, setEditedDraft] = useState("");
  const [drafts, setDrafts] = useState<{ baseline: GeneratedDraft; inVoice: GeneratedDraft; context: { brief: string; audience: string; areaId: string; profileVersion: number } } | null>(null);
  const [publication, setPublication] = useState<{
    path: string;
    backupPath: string | null;
  } | null>(null);
  const [status, setStatus] = useState("");
  const [draftError, setDraftError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const compiled = useMemo(() => compileSkillPackage(state.profile), [state.profile]);

  async function handleGenerateDrafts() {
    if (!prompt.trim()) return;
    setIsGenerating(true);
    setDraftError(null);
    try {
      const context = { brief: prompt.trim(), audience, areaId, profileVersion: state.profile.currentVersion };
      const voiceGuidance = state.profile.rules
        .filter((rule) => (rule.state === "approved" || rule.state === "locked") && (rule.scope === "core" || rule.scope === areaId))
        .map((rule) => rule.instruction);
      const request = { ...context, useVoice: false, voiceGuidance } as const;
      const [baseline, inVoice] = await Promise.all([
        generateDraft(request),
        generateDraft({ ...request, useVoice: true }),
      ]);
      setDrafts({ baseline, inVoice, context });
      setEditedDraft(inVoice.text);
    } catch (error) {
      setDraftError(error instanceof Error ? error.message : "Could not generate drafts.");
    } finally {
      setIsGenerating(false);
    }
  }

  async function handlePublish() {
    setStatus("Publishing...");
    try {
      const result = await publishVoiceSkill(
        compiled.manifest.skillName,
        compiled.manifest.profileVersion,
        compiled.files["SKILL.md"],
        compiled.files,
        compiled.manifest,
      );
      setPublication({ path: result.path, backupPath: result.backupPath });
      const reloadNote = result.status === "needs-reload" || result.status === "pending-update"
        ? " Reload Codex to discover the change."
        : " Codex discovery is not verified yet; reload before relying on it.";
      setStatus(`${result.backupPath ? "Published update" : "Published"} to ${result.path}.${result.backupPath ? " Previous skill backed up." : ""}${reloadNote}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
    }
  }

  async function handleRestore() {
    if (!publication) return;
    setStatus("Restoring...");
    try {
      await restoreVoiceSkill(publication.path, publication.backupPath);
      setStatus(publication.backupPath ? "Previous skill restored." : "Published skill removed.");
      setPublication(null);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
    }
  }

  return (
    <section className="panel" aria-labelledby="test-heading">
      <h2 id="test-heading">Test & Use</h2>
      <div className="test-grid">
        <label>
          Brief
          <textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} rows={8} placeholder="What are you writing?" />
        </label>
        <pre className="skill-preview" aria-label="Compiled skill">{compiled.files["SKILL.md"]}</pre>
      </div>
      <div className="form-grid">
        <label>Audience<input value={audience} onChange={(event) => setAudience(event.target.value)} placeholder="Who is this for?" /></label>
        <label>Voice area<select value={areaId} onChange={(event) => setAreaId(event.target.value)}><option value="email">Email</option><option value="essay">Essay</option><option value="plan">Plan</option><option value="core">Core</option></select></label>
      </div>
      <div className="action-row">
        <button type="button" className="primary" onClick={handleGenerateDrafts} disabled={!prompt.trim() || isGenerating}>
          {isGenerating ? "Generating…" : "Generate drafts"}
        </button>
      </div>
      {draftError && <p role="alert" className="error">{draftError}</p>}
      {drafts && (
        <>
          <div className="test-grid">
            <label>Baseline draft<textarea value={drafts.baseline.text} readOnly rows={10} /></label>
            <label>Your edited draft<textarea aria-label="Your edited draft" value={editedDraft} onChange={(event) => setEditedDraft(event.target.value)} rows={10} /></label>
          </div>
          <p className="note">
            Baseline: {drafts.baseline.model} · {drafts.baseline.effort} · no voice guidance. In-voice: {drafts.inVoice.model} · {drafts.inVoice.effort} · {drafts.inVoice.areaId} · profile v{drafts.inVoice.profileVersion}.
          </p>
          <button type="button" className="chip" disabled={!editedDraft.trim()} onClick={() => onTransferToTeach?.({ generatedDraft: drafts.inVoice.text, finalRevision: editedDraft, task: drafts.context.brief, audience: drafts.context.audience, areaId: drafts.context.areaId, profileVersion: drafts.context.profileVersion })}>
            Transfer correction pair
          </button>
        </>
      )}
      <div className="publish-bar">
        <button type="button" className="primary" onClick={handlePublish}>
          Publish to Codex
        </button>
        {publication && (
          <button type="button" className="chip" onClick={handleRestore}>
            Restore previous
          </button>
        )}
      </div>
      <p className="note">
        Compiled skill: <code>{compiled.manifest.skillName}</code> v{compiled.manifest.profileVersion}. Publishing writes locally
        to the My Voice skill folder.
      </p>
      {status && <p role="status">{status}</p>}

      <h2>Version history</h2>
      {state.profile.versions.length === 0 && <p className="empty">No saved versions yet.</p>}
      <ul className="version-list">
        {state.profile.versions.map((version) => (
          <li key={version.version}>
            <strong>v{version.version}</strong> · {version.summary}
            <button
              type="button"
              className="chip"
              onClick={() => {
                const profile = rollbackToVersion(state.profile, version.version);
                setState({ ...state, profile });
              }}
            >
              Roll back
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
