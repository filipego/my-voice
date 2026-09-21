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
    <section className="pane" aria-labelledby="test-heading">
      <header className="pane-header">
        <div>
          <h2 id="test-heading">Test & Use</h2>
          <p>
            Compiled skill: <code>{compiled.name}</code> v{compiled.version}. Publishing writes locally
            to the My Voice skill folder.
          </p>
        </div>
        <div className="action-row">
          <button type="button" className="button" onClick={handlePublish}>
            Publish to Codex
          </button>
          {publication && (
            <button type="button" className="button button-quiet" onClick={handleRestore}>
              Restore previous
            </button>
          )}
        </div>
      </header>

      <div className="split">
        <label className="field">
          Brief
          <textarea
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            rows={8}
            placeholder="What are you writing?"
          />
        </label>
        <div className="field">
          <span>Compiled skill</span>
          <pre className="skill-preview" aria-label="Compiled skill">{compiled.markdown}</pre>
        </div>
      </div>

      {status && <p role="status" className="status-line">{status}</p>}

      <section className="section-block" aria-labelledby="versions-heading">
        <h3 id="versions-heading">Version history</h3>
        {state.profile.versions.length === 0 && <p className="empty">No saved versions yet.</p>}
        <ul className="item-list">
          {state.profile.versions.map((version) => (
            <li key={version.version} className="version-row">
              <div className="version-copy">
                <strong>v{version.version}</strong>
                <span className="item-meta">{version.summary}</span>
              </div>
              <button
                type="button"
                className="button button-quiet"
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
    </section>
  );
}
