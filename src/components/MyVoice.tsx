import type { AppState } from "../core/storage";
import { proposeRule, publishProfile, setRuleState } from "../core/profileEngine";

interface Props {
  state: AppState;
  setState: (value: AppState) => void;
}

export default function MyVoice({ state, setState }: Props) {
  function update(id: string, next: Exclude<AppState["profile"]["rules"][number]["state"], "proposed">) {
    setState({ ...state, profile: setRuleState(state.profile, id, next) });
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
            <p className="rule-text">{rule.instruction}</p>
            <p className="rule-meta">{rule.scope} · {rule.state} · {rule.confidence}</p>
            <ul className="evidence-list">
              {rule.evidence.map((item, index) => (
                <li key={`${rule.id}-${index}`}>{item}</li>
              ))}
            </ul>
            <div className="action-row">
              {(["approved", "rejected", "locked"] as const).map((choice) => (
                <button key={choice} type="button" className="chip" onClick={() => update(rule.id, choice)}>
                  {choice}
                </button>
              ))}
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
