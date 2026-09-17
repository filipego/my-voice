import { useEffect, useMemo, useRef, useState } from "react";
import { loadState, saveState, type AppState } from "./core/storage";
import { initialProfile } from "./core/profileEngine";
import Library from "./components/Library";
import MyVoice from "./components/MyVoice";
import TeachMyVoice from "./components/TeachMyVoice";
import TestAndUse from "./components/TestAndUse";
import { runCodexAnalysis } from "./core/codexAdapter";

type Tab = "library" | "profile" | "teach" | "test";

export default function App() {
  const [state, setState] = useState<AppState>({ profile: initialProfile, sources: [] });
  const [isLoaded, setIsLoaded] = useState(false);
  const skipNextSaveRef = useRef(false);
  const [tab, setTab] = useState<Tab>("library");
  const tabs: { id: Tab; label: string }[] = [
    { id: "library", label: "Library" },
    { id: "profile", label: "My Voice" },
    { id: "teach", label: "Teach" },
    { id: "test", label: "Test & Use" },
  ];

  useEffect(() => {
    let active = true;

    async function restore() {
      const restored = await loadState();
      if (active) setState(restored);
      if (active) {
        skipNextSaveRef.current = true;
        setIsLoaded(true);
      }
    }

    void restore();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!isLoaded) return;
    if (skipNextSaveRef.current) {
      skipNextSaveRef.current = false;
      return;
    }
    void saveState(state);
  }, [isLoaded, state]);

  const evidenceCount = useMemo(
    () => state.profile.rules.reduce((count, rule) => count + rule.evidence.length, 0),
    [state.profile.rules],
  );

  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <h1>My Voice</h1>
          <p>Review your writing, approve lessons, and publish a versioned Codex skill.</p>
        </div>
        <span className="status-pill">Profile v{state.profile.currentVersion || 1}</span>
      </header>

      <nav aria-label="Main sections" className="tab-strip">
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            className={tab === item.id ? "tab-button active" : "tab-button"}
            aria-current={tab === item.id}
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </nav>

      <main>
        {tab === "library" && <Library state={state} setState={setState} />}
        {tab === "profile" && <MyVoice state={state} setState={setState} />}
        {tab === "teach" && (
          <TeachMyVoice state={state} setState={setState} runCodexAnalysis={runCodexAnalysis} />
        )}
        {tab === "test" && <TestAndUse state={state} setState={setState} />}
      </main>

      <footer>
        {state.sources.length} sources · {evidenceCount} evidence links · approved writing may be sent to OpenAI only for an analysis you start.
      </footer>
    </div>
  );
}
