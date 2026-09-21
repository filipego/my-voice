import type { AppState } from "../core/storage";
import { publishProfile, setRuleState } from "../core/profileEngine";

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
    <section className="pane" aria-labelledby="profile-heading">
      <header className="pane-header">
        <div>
          <h2 id="profile-heading">My Voice</h2>
          <p>Each rule stays tied to the writing it came from.</p>
        </div>
        <button
          type="button"
          className="button"
          onClick={publish}
          disabled={state.profile.rules.length === 0}
        >
          Save profile version
        </button>
      </header>

      {state.profile.rules.length === 0 && (
        <p className="empty">No rules yet. Teach My Voice with a correction pair first.</p>
      )}
      <ul className="item-list">
        {state.profile.rules.map((rule) => (
          <li key={rule.id} className="item-card">
            <p className="rule-text">{rule.instruction}</p>
            <p className="item-meta">{rule.scope} · {rule.state} · {rule.confidence}</p>
            {rule.evidence.length > 0 && (
              <ul className="evidence-list">
                {rule.evidence.map((item, index) => (
                  <li key={`${rule.id}-${index}`}>{item}</li>
                ))}
              </ul>
            )}
            <div className="chip-row">
              {(["approved", "rejected", "locked"] as const).map((choice) => (
                <button
                  key={choice}
                  type="button"
                  className={rule.state === choice ? "chip active" : "chip"}
                  aria-pressed={rule.state === choice}
                  onClick={() => update(rule.id, choice)}
                >
                  {choice}
                </button>
              ))}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
