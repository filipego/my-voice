import { useEffect, useMemo, useRef, useState } from "react";
import { invoke, isTauri } from "@tauri-apps/api/core";
import { loadState, saveState, type AppState } from "./core/storage";
import { initialProfile } from "./core/profileEngine";
import Library from "./components/Library";
import MyVoice from "./components/MyVoice";
import TeachMyVoice from "./components/TeachMyVoice";
import TestAndUse from "./components/TestAndUse";
import { generateDraft, runCodexAnalysis, type CodexConnection, type CodexEffort } from "./core/codexAdapter";
import type { CorrectionPairTransfer } from "./components/TestAndUse";
import { createCorrectionRecord } from "./core/correctionEngine";
import {
  canUpdateApp,
  describeUpdateError,
  findAppUpdate,
  installAppUpdate,
  isMissingPublishedRelease,
  type AppUpdateStatus,
} from "./core/appUpdater";
import type { AppUpdateOffer } from "./core/appUpdater";

type Tab = "library" | "profile" | "teach" | "test";

export default function App() {
  const [state, setState] = useState<AppState>({ profile: initialProfile, sources: [] });
  const [isLoaded, setIsLoaded] = useState(false);
  const skipNextSaveRef = useRef(false);
  const [tab, setTab] = useState<Tab>("library");
  const [effort, setEffort] = useState<CodexEffort>("medium");
  const [codexConnection, setCodexConnection] = useState<CodexConnection | null>(null);
  const [analysisController, setAnalysisController] = useState(() => new AbortController());
  const [pendingCorrectionPair, setPendingCorrectionPair] = useState<CorrectionPairTransfer | null>(null);
  const [updateStatus, setUpdateStatus] = useState<AppUpdateStatus>({ kind: "idle" });
  const pendingUpdateRef = useRef<AppUpdateOffer | null>(null);
  const updateCheckInFlightRef = useRef(false);
  const tabs: { id: Tab; label: string }[] = [
    { id: "library", label: "Library" },
    { id: "profile", label: "My Voice" },
    { id: "teach", label: "Teach" },
    { id: "test", label: "Test & Use" },
  ];
  const pageMeta: Record<Tab, { title: string; description: string }> = {
    library: { title: "Library", description: "Keep the writing you choose to teach from close at hand." },
    profile: { title: "My Voice", description: "Review the guidance your writing has earned." },
    teach: { title: "Teach", description: "Turn clear corrections into lessons you can approve." },
    test: { title: "Test & Use", description: "Try the current voice and publish a local skill." },
  };

  async function checkForAppUpdates() {
    if (!canUpdateApp() || updateCheckInFlightRef.current) return;
    updateCheckInFlightRef.current = true;
    setUpdateStatus({ kind: "checking" });
    try {
      const update = await findAppUpdate();
      pendingUpdateRef.current = update;
      setUpdateStatus(update
        ? { kind: "available", version: update.version }
        : { kind: "up-to-date" });
    } catch (error: unknown) {
      pendingUpdateRef.current = null;
      setUpdateStatus({
        kind: "error",
        message: isMissingPublishedRelease(error) ? "No published release yet." : describeUpdateError(error),
        expected: isMissingPublishedRelease(error),
      });
    } finally {
      updateCheckInFlightRef.current = false;
    }
  }

  async function installAvailableUpdate() {
    const update = pendingUpdateRef.current;
    if (!update) {
      await checkForAppUpdates();
      return;
    }
    setUpdateStatus({ kind: "installing", version: update.version, downloadedBytes: 0 });
    try {
      await installAppUpdate();
    } catch (error: unknown) {
      setUpdateStatus({ kind: "error", message: describeUpdateError(error) });
    }
  }

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
    if (canUpdateApp()) void checkForAppUpdates();
  }, []);

  useEffect(() => {
    if (!isLoaded) return;
    if (skipNextSaveRef.current) {
      skipNextSaveRef.current = false;
      return;
    }
    void saveState(state);
  }, [isLoaded, state]);

  useEffect(() => {
    if (!isTauri()) {
      setCodexConnection({ available: false, authenticated: false, detail: "Desktop app required." });
      return;
    }
    void invoke<CodexConnection>("check_codex_connection")
      .then(setCodexConnection)
      .catch((error: unknown) => setCodexConnection({
        available: false,
        authenticated: false,
        detail: error instanceof Error ? error.message : "Could not check Codex status.",
      }));
  }, []);

  const evidenceCount = useMemo(
    () => state.profile.rules.reduce((count, rule) => count + rule.evidence.length, 0),
    [state.profile.rules],
  );

  function cancelAnalysis() {
    analysisController.abort();
    setAnalysisController(new AbortController());
  }

  function transferCorrectionPair(pair: CorrectionPairTransfer) {
    setTab("teach");
    setPendingCorrectionPair(pair);
    // Teach My Voice remains the decision surface; keep the pair in the app state
    // so a future reload does not lose the user's explicit transfer.
    const record = createCorrectionRecord(pair);
    setState({ ...state, corrections: [...(state.corrections ?? []), record] });
  }

  return (
    <div className="app-shell">
      <aside className="app-sidebar">
        <div className="brand-lockup">
          <span className="brand-mark" aria-hidden="true">MV</span>
          <div>
            <strong>My Voice</strong>
            <span>Writing profile</span>
          </div>
        </div>

        <nav aria-label="Main sections" className="tab-strip">
          <span className="nav-label">Workspace</span>
          {tabs.map((item) => (
            <button
              key={item.id}
              type="button"
              className={tab === item.id ? "tab-button active" : "tab-button"}
              aria-current={tab === item.id}
              onClick={() => setTab(item.id)}
            >
              <span className={`nav-glyph nav-glyph-${item.id}`} aria-hidden="true" />
              {item.label}
            </button>
          ))}
        </nav>

        <div className="sidebar-footnote">
          <span className="sidebar-footnote-label">Local workspace</span>
          <span>Your sources stay on this Mac.</span>
        </div>
      </aside>

      <section className="app-content">
        <header className="app-header">
          <div className="page-heading">
            <h1>{pageMeta[tab].title}</h1>
            <p>{pageMeta[tab].description}</p>
          </div>
          <div className="secondary-status" aria-label="Codex status and effort">
            <span className="status-pill">Profile v{state.profile.currentVersion || 1}</span>
            <span className="status-pill" role="status">
              <span className={codexConnection?.authenticated ? "status-dot online" : "status-dot"} aria-hidden="true" />
              Codex {codexConnection?.authenticated ? "authenticated" : codexConnection?.available ? "not authenticated" : "unavailable"}
            </span>
            {canUpdateApp() && (
              <div className="app-update-control">
                <button
                  type="button"
                  className={updateStatus.kind === "available" ? "update-control ready" : "update-control"}
                  onClick={updateStatus.kind === "available" ? () => void installAvailableUpdate() : () => void checkForAppUpdates()}
                  disabled={updateStatus.kind === "checking" || updateStatus.kind === "installing"}
                  title={updateStatus.kind === "error" ? updateStatus.message : undefined}
                >
                  {updateStatus.kind === "checking" && "Checking for updates…"}
                  {updateStatus.kind === "installing" && `Installing v${updateStatus.version}…`}
                  {updateStatus.kind === "available" && `Update to v${updateStatus.version}`}
                  {(updateStatus.kind === "idle" || updateStatus.kind === "up-to-date" || updateStatus.kind === "error") && "Check for updates"}
                </button>
                {updateStatus.kind === "error" && (
                  <span className={updateStatus.expected ? "update-hint expected" : "update-hint"} role="status">
                    {updateStatus.expected ? "No published release yet" : "Update check unavailable"}
                  </span>
                )}
              </div>
            )}
            <label className="effort-control">
              Effort
              <select value={effort} onChange={(event) => setEffort(event.target.value as CodexEffort)}>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="max">Max</option>
              </select>
            </label>
          </div>
        </header>

        <main>
          {tab === "library" && <Library state={state} setState={setState} />}
          {tab === "profile" && <MyVoice state={state} setState={setState} />}
          {tab === "teach" && (
            <TeachMyVoice
              state={state}
              setState={setState}
              analysisSignal={analysisController.signal}
              onCancelAnalysis={cancelAnalysis}
              runCodexAnalysis={(request) => runCodexAnalysis(request, { model: "gpt-5.6-luna", effort, timeoutMs: 180_000, signal: request.signal })}
              initialPair={pendingCorrectionPair ?? undefined}
              onConsumeSeed={() => setPendingCorrectionPair(null)}
            />
          )}
          {tab === "test" && <TestAndUse state={state} setState={setState} generateDraft={(request) => generateDraft({ ...request, effort })} onTransferToTeach={transferCorrectionPair} />}
        </main>

        <footer>
          <span>{state.sources.length} sources</span>
          <span>{evidenceCount} evidence links</span>
          <span>Approved writing may be sent to OpenAI only for an analysis you start.</span>
        </footer>
      </section>
    </div>
  );
}
