import { useState } from "react";
import type { AppState } from "../core/storage";
import { editRule, publishProfile, setRuleState, supersedeRule } from "../core/profileEngine";

interface Props {
  state: AppState;
  setState: (value: AppState) => void;
}

export default function MyVoice({ state, setState }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  function update(id: string, next: Exclude<AppState["profile"]["rules"][number]["state"], "proposed">) {
    const changed = setRuleState(state.profile, id, next);
    if (changed === state.profile) return;
    setState({ ...state, profile: publishProfile(changed, `Rule ${next}.`) });
  }

  function saveEdit(id: string) {
    const changed = editRule(state.profile, id, editText);
    if (changed === state.profile) return;
    setState({ ...state, profile: publishProfile(changed, "Edited voice rule.") });
    setEditingId(null);
  }

  function publish() {
    setState({ ...state, profile: publishProfile(state.profile, "Manual profile checkpoint.") });
  }

  return (
    <section className="panel" aria-labelledby="profile-heading">
      <h2 id="profile-heading">Approved voice rules</h2>
      {state.profile.rules.length === 0 && <p className="empty">No rules yet. Teach My Voice with a correction pair first.</p>}
      <ul className="rule-list">
        {state.profile.rules.map((rule) => (
          <li key={rule.id}>
            {editingId === rule.id ? (
              <div className="action-row">
                <input aria-label="Edit rule" value={editText} onChange={(event) => setEditText(event.target.value)} />
                <button type="button" className="chip" onClick={() => saveEdit(rule.id)}>Save rule</button>
                <button type="button" className="chip" onClick={() => setEditingId(null)}>Cancel</button>
              </div>
            ) : <p className="rule-text">{rule.instruction}</p>}
            <p className="rule-meta">{rule.scope} · {rule.state} · {rule.confidence}</p>
            <ul className="evidence-list">
              {rule.evidence.map((item, index) => (
                <li key={`${rule.id}-${index}`}>{typeof item === "string" ? item : `${item.excerpt} (source ${item.sourceId}, paragraph ${item.paragraphId})`}</li>
              ))}
            </ul>
            <div className="action-row">
              {(["approved", "rejected", "locked"] as const).map((choice) => (
                <button key={choice} type="button" className="chip" onClick={() => update(rule.id, choice)}>
                  {choice}
                </button>
              ))}
              <button type="button" className="chip" disabled={rule.state === "locked"} onClick={() => { setEditingId(rule.id); setEditText(rule.instruction); }}>Edit</button>
              <button type="button" className="chip" disabled={rule.state === "locked"} onClick={() => {
                const next = supersedeRule(state.profile, rule.id, { instruction: `${rule.instruction} (revised)`, origin: rule.origin, scope: rule.scope, evidence: rule.evidence });
                if (next !== state.profile) setState({ ...state, profile: publishProfile(next, "Superseded voice rule.") });
              }}>Supersede</button>
            </div>
          </li>
        ))}
      </ul>
      <div className="action-row">
        <button type="button" onClick={publish} disabled={state.profile.rules.length === 0}>
          Save profile version
        </button>
      </div>
    </section>
  );
}
