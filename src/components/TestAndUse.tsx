import { useMemo, useState } from "react";
import type { AppState } from "../core/storage";
import { publishVoiceSkill, restoreVoiceSkill } from "../core/storage";
import { compileSkill } from "../core/skillCompiler";
import { rollbackToVersion } from "../core/profileEngine";

interface Props {
  state: AppState;
  setState: (value: AppState) => void;
}

export default function TestAndUse({ state, setState }: Props) {
  const [prompt, setPrompt] = useState("");
  const [publication, setPublication] = useState<{
    path: string;
    backupPath: string | null;
  } | null>(null);
  const [status, setStatus] = useState("");
  const compiled = useMemo(() => compileSkill(state.profile), [state.profile]);

  async function handlePublish() {
    setStatus("Publishing...");
    try {
      const result = await publishVoiceSkill(
        compiled.name,
        compiled.version,
        compiled.markdown,
      );
      setPublication({ path: result.path, backupPath: result.backupPath });
      setStatus(
        result.backupPath
          ? `Published to ${result.path}. Previous skill backed up.`
          : `Published to ${result.path}.`,
      );
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
        <pre className="skill-preview" aria-label="Compiled skill">{compiled.markdown}</pre>
      </div>
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
        Compiled skill: <code>{compiled.name}</code> v{compiled.version}. Publishing writes locally
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
