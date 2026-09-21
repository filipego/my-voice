import { useRef, useState } from "react";
import { deleteSourceEvidence, sourceEvidenceImpact, type AppState } from "../core/storage";
import { createSource, importWritingFile, isDuplicateText, normalizedDuplicateKey, type ImportPreview } from "../core/sourceImport";

interface Props {
  state: AppState;
  setState: (value: AppState) => void;
}

function sourceIdentityText(source: AppState["sources"][number]): string {
  return source.paragraphDecisions?.length
    ? source.paragraphDecisions.map((paragraph) => paragraph.text).join("\n\n")
    : source.paragraphs.join("\n\n");
}

export default function Library({ state, setState }: Props) {
  const [draft, setDraft] = useState("");
  const [title, setTitle] = useState("");
  const [format, setFormat] = useState<"email" | "essay" | "plan" | "other">("other");
  const [authorship, setAuthorship] = useState<"original" | "revised" | "ai-assisted">("original");
  const [error, setError] = useState<string | null>(null);
  const [duplicateResult, setDuplicateResult] = useState<string | null>(null);
  const [replaceDuplicate, setReplaceDuplicate] = useState(false);
  const [voiceArea, setVoiceArea] = useState("general guidance");
  const [filePreview, setFilePreview] = useState<ImportPreview | null>(null);
  const [fileLoading, setFileLoading] = useState(false);
  const fileRequest = useRef(0);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  function addSource() {
    try {
      const source = createSource(draft, { title, format, authorship });
      const duplicate = state.sources.find((item) => normalizedDuplicateKey(sourceIdentityText(item)) === normalizedDuplicateKey(draft));
      if (duplicate && !replaceDuplicate) {
        setError("This exact source has already been imported.");
        return;
      }
      const nextSource = { ...source, voiceArea };
      setState(duplicate && replaceDuplicate
        ? { ...state, sources: state.sources.map((item) => item.id === duplicate.id ? { ...item, title: nextSource.title, authorship: nextSource.authorship, format: nextSource.format, voiceArea: nextSource.voiceArea } : item) }
        : { ...state, sources: [nextSource, ...state.sources] });
      setDraft("");
      setTitle("");
      setError(null);
      setDuplicateResult(null);
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : "Import failed.");
    }
  }

  async function chooseFile(file: File | undefined) {
    if (!file) return;
    const requestId = fileRequest.current + 1;
    fileRequest.current = requestId;
    setFilePreview(null);
    setFileLoading(true);
    setError(null);
    try {
      const preview = await importWritingFile(file);
      if (requestId !== fileRequest.current) return;
      setFilePreview(preview);
      setTitle(file.name.replace(/\.[^.]+$/, ""));
    } catch (importError) {
      if (requestId !== fileRequest.current) return;
      setFilePreview(null);
      setError(importError instanceof Error ? importError.message : "File import failed.");
    } finally {
      if (requestId === fileRequest.current) setFileLoading(false);
    }
  }

  function addFileSource() {
    if (!filePreview) return;
    const duplicate = state.sources.find((item) => normalizedDuplicateKey(sourceIdentityText(item)) === normalizedDuplicateKey(filePreview.paragraphs.map((paragraph) => paragraph.text).join("\n\n")));
    if (duplicate && !replaceDuplicate) {
      setError("This exact source has already been imported. Enable replace metadata to continue.");
      return;
    }
    const included = filePreview.paragraphs.filter((paragraph) => paragraph.decision === "included");
    if (included.length === 0) {
      setError("Include at least one paragraph before importing.");
      return;
    }
    const source = createSource(included.map((paragraph) => paragraph.text).join("\n\n"), { title, format, authorship });
    if (duplicate && replaceDuplicate) {
      setState({ ...state, sources: state.sources.map((item) => item.id === duplicate.id ? { ...item, title: title.trim() || item.title, authorship, format, voiceArea } : item) });
      setFilePreview(null);
      setError(null);
      return;
    }
    const nextSource = {
      ...source,
      id: `src_${filePreview.hash.slice(0, 18)}`,
      hash: filePreview.hash,
      voiceArea,
      paragraphDecisions: filePreview.paragraphs,
    };
    setState({ ...state, sources: [nextSource, ...state.sources] });
    setFilePreview(null);
    setError(null);
  }

  function updateStatus(id: string, status: AppState["sources"][number]["status"]) {
    setState({
      ...state,
      sources: state.sources.map((source) => (source.id === id ? { ...source, status } : source)),
    });
  }

  function deleteSource(id: string) {
    setState(deleteSourceEvidence(state, id));
    setPendingDeleteId(null);
  }

  return (
    <section className="panel" aria-labelledby="library-heading">
      <h2 id="library-heading">Add writing</h2>
      <div className="form-grid">
        <label>
          Title
          <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Planning note" />
        </label>
        <label>
          Format
          <select value={format} onChange={(event) => setFormat(event.target.value as typeof format)}>
            <option value="other">Other</option>
            <option value="email">Email</option>
            <option value="essay">Essay</option>
            <option value="plan">Plan</option>
          </select>
        </label>
        <label>
          Authorship
          <select value={authorship} onChange={(event) => setAuthorship(event.target.value as typeof authorship)}>
            <option value="original">Original human writing</option>
            <option value="revised">Revised human writing</option>
            <option value="ai-assisted">AI-assisted draft</option>
          </select>
        </label>
        <label>
          Voice area
          <input value={voiceArea} onChange={(event) => setVoiceArea(event.target.value)} placeholder="general guidance" />
        </label>
      </div>
      <label>
        Writing file (.txt, .md, or .docx)
        <input type="file" disabled={fileLoading} accept=".txt,.md,.docx,text/plain,text/markdown,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={(event) => void chooseFile(event.target.files?.[0])} />
      </label>
      {filePreview && (
        <div className="source-preview" role="region" aria-label="Import preview">
          <p><strong>{filePreview.filename}</strong> · {filePreview.paragraphs.length} paragraphs</p>
          {filePreview.paragraphs.map((paragraph, index) => (
            <label key={paragraph.id}>
              <input aria-label={`Include paragraph ${index + 1}`} type="checkbox" checked={paragraph.decision === "included"} onChange={() => setFilePreview({ ...filePreview, paragraphs: filePreview.paragraphs.map((item, itemIndex) => itemIndex === index ? { ...item, decision: item.decision === "included" ? "excluded" : "included" } : item) })} />
              <span>Include paragraph {index + 1}</span>: <span>{paragraph.text}</span>
            </label>
          ))}
          <button type="button" onClick={addFileSource}>Import file</button>
        </div>
      )}
      <label className="textarea-label">
        Text
        <textarea value={draft} onChange={(event) => setDraft(event.target.value)} rows={9} />
      </label>
      <div className="action-row">
        <button type="button" onClick={addSource} disabled={!draft.trim()}>
          Import
        </button>
        <button type="button" className="button-quiet" onClick={() => setDuplicateResult(isDuplicateText(draft, state.sources.map(sourceIdentityText)) ? "Duplicate found. Review metadata before importing." : "No duplicate found.")}>
          Check duplicate
        </button>
        <label className="check-inline"><input type="checkbox" checked={replaceDuplicate} onChange={(event) => setReplaceDuplicate(event.target.checked)} /> Replace duplicate metadata</label>
      </div>
      {error && <p className="warning" role="alert">{error}</p>}
      {duplicateResult && <p className="status" role="status">{duplicateResult}</p>}

      <h2>Sources</h2>
      {state.sources.length === 0 && <p className="empty">No sources yet.</p>}
      <ul className="source-list">
        {state.sources.map((source) => (
          <li key={source.id}>
            <div className="source-heading">
              <strong>{source.title}</strong>
              <span>{source.format} · {source.authorship}</span>
            </div>
            <p>{source.paragraphs[0]?.slice(0, 220)}{source.paragraphs[0]?.length > 220 ? "…" : ""}</p>
            <div className="source-actions">
              {(["approved", "excluded", "evaluation", "unprocessed"] as const).map((status) => (
                <button
                  key={status}
                  type="button"
                  className={source.status === status ? "chip active" : "chip"}
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
                  {sourceEvidenceImpact(state, source.id) > 0 && (
                    <p className="warning" role="alert">
                      Deleting this source will remove {sourceEvidenceImpact(state, source.id)} linked rule{sourceEvidenceImpact(state, source.id) === 1 ? "" : "s"}.
                    </p>
                  )}
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
  );
}
