import { useMemo, useState } from "react";
import type { AppState } from "../core/storage";
import { compileSkill } from "../core/skillCompiler";
import { rollbackToVersion } from "../core/profileEngine";

interface Props {
  state: AppState;
  setState: (value: AppState) => void;
}

export default function TestAndUse({ state, setState }: Props) {
  const [prompt, setPrompt] = useState("");
  const compiled = useMemo(() => compileSkill(state.profile), [state.profile]);

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
      <p className="note">Compiled skill: <code>{compiled.name}</code> v{compiled.version}. Export remains local until you copy the package into Codex discovery.</p>

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
