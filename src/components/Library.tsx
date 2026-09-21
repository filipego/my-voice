import { useState } from "react";
import type { AppState } from "../core/storage";
import { createSource, isDuplicateText } from "../core/sourceImport";

interface Props {
  state: AppState;
  setState: (value: AppState) => void;
}

export default function Library({ state, setState }: Props) {
  const [draft, setDraft] = useState("");
  const [title, setTitle] = useState("");
  const [format, setFormat] = useState<"email" | "essay" | "plan" | "other">("other");
  const [authorship, setAuthorship] = useState<"original" | "revised" | "ai-assisted">("original");
  const [error, setError] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  function addSource() {
    try {
      const source = createSource(draft, { title, format, authorship });
      if (state.sources.some((item) => item.hash === source.hash)) {
        setError("This exact source has already been imported.");
        return;
      }
      setState({ ...state, sources: [source, ...state.sources] });
      setDraft("");
      setTitle("");
      setError(null);
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : "Import failed.");
    }
  }

  function updateStatus(id: string, status: AppState["sources"][number]["status"]) {
    setState({
      ...state,
      sources: state.sources.map((source) => (source.id === id ? { ...source, status } : source)),
    });
  }

  function deleteSource(id: string) {
    setState({
      ...state,
      sources: state.sources.filter((source) => source.id !== id),
    });
    setPendingDeleteId(null);
  }

  return (
    <section className="pane" aria-labelledby="library-heading">
      <header className="pane-header">
        <div>
          <h2 id="library-heading">Library</h2>
          <p>Paste writing, then mark what this profile may learn from.</p>
        </div>
      </header>

      <div className="composer">
        <div className="composer-stack">
          <div className="form-grid">
            <label className="field">
              Title
              <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Planning note" />
            </label>
            <label className="field">
              Format
              <select value={format} onChange={(event) => setFormat(event.target.value as typeof format)}>
                <option value="other">Other</option>
                <option value="email">Email</option>
                <option value="essay">Essay</option>
                <option value="plan">Plan</option>
              </select>
            </label>
            <label className="field">
              Authorship
              <select value={authorship} onChange={(event) => setAuthorship(event.target.value as typeof authorship)}>
                <option value="original">Original human writing</option>
                <option value="revised">Revised human writing</option>
                <option value="ai-assisted">AI-assisted draft</option>
              </select>
            </label>
          </div>
          <label className="field">
            Text
            <textarea value={draft} onChange={(event) => setDraft(event.target.value)} rows={9} />
          </label>
          <div className="action-row">
            <button type="button" className="button" onClick={addSource} disabled={!draft.trim()}>
              Import
            </button>
            <button
              type="button"
              className="button button-quiet"
              onClick={() => isDuplicateText(draft, state.sources.map((source) => source.paragraphs.join("\n\n")))}
            >
              Check duplicate
            </button>
          </div>
          {error && <p className="warning" role="alert">{error}</p>}
        </div>
      </div>

      <section className="section-block" aria-labelledby="sources-heading">
        <h3 id="sources-heading">Sources</h3>
        {state.sources.length === 0 && <p className="empty">No sources yet.</p>}
        <ul className="item-list">
          {state.sources.map((source) => (
            <li key={source.id} className="item-card">
              <div className="item-lead">
                <strong>{source.title}</strong>
                <p className="item-meta">{source.format} · {source.authorship}</p>
              </div>
              <p className="item-excerpt">
                {source.paragraphs[0]?.slice(0, 220)}{source.paragraphs[0]?.length > 220 ? "…" : ""}
              </p>
              <div className="chip-row">
                {(["approved", "excluded", "evaluation", "unprocessed"] as const).map((status) => (
                  <button
                    key={status}
                    type="button"
                    className={source.status === status ? "chip active" : "chip"}
                    aria-pressed={source.status === status}
                    onClick={() => updateStatus(source.id, status)}
                  >
                    {status}
                  </button>
                ))}
                <button
                  type="button"
                  className="chip danger"
                  onClick={() => setPendingDeleteId(source.id)}
                >
                  Delete
                </button>
                {pendingDeleteId === source.id && (
                  <>
                    <button
                      type="button"
                      className="chip danger"
                      onClick={() => deleteSource(source.id)}
                    >
                      Delete source
                    </button>
                    <button
                      type="button"
                      className="chip"
                      onClick={() => setPendingDeleteId(null)}
                    >
                      Cancel delete
                    </button>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      </section>
    </section>
  );
}
