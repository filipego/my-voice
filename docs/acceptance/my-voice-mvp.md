# My Voice MVP acceptance ledger

Date: 2026-09-21

## Automated release gate

- `npm test` — PASS (66 tests)
- `npm run typecheck` — PASS
- `npm run build` — PASS
- `cargo test --manifest-path src-tauri/Cargo.toml` — PASS (14 native unit tests, 3 persistence tests)
- Impeccable detector on `src/components/TestAndUse.tsx` — PASS (no findings)

## Verified implementation evidence

- Persisted profile normalization and unsupported-version protection.
- Paste, text, Markdown, and DOCX import review with exclusions and duplicate handling.
- Evidence-aware source deletion and reversible rule review.
- Luna model/effort controls, cancellation, timeout, malformed-output handling, and draft generation.
- Correction classifications and explicit durable/context-only/one-time/wrong-interpretation decisions.
- Baseline/in-voice draft comparison with context-preserving Teach transfer.
- Modular package compilation with area references, manifest checksums, anti-slop attribution, and collision-safe routing.
- Package publication to the user Codex skill root with checksum/external-edit detection, atomic update, backup, restore, and traversal protection.
- Test & Use anti-slop warnings with area-scoped allow/dismiss decisions persisted in app state and included in the published package.
- Published package area/profile-version verification is now exposed in the desktop flow; live Codex discovery remains separately unverified.

## Exact packaged-surface evidence

- Bundle: `src-tauri/target/release/bundle/macos/My Voice.app`
- The packaged window was exposed to the desktop verifier as `My Voice`.
- Exercised Library → Test & Use → draft generation, editable final revision, Transfer correction pair, Teach prefill, and Just this time.
- Published to `/Users/filipego/.codex/skills/my-voice` and received the visible status `Published selection verified.` with `Published manifest matches the requested area and profile version.` for Core/profile v1.
- Codex local prompt assembly now lists `my-voice: Personal writing voice guidance for my-voice` under available skills after republish, proving local discovery without sending private skill contents to a model.
- The app still reports reload guidance because an already-running Codex session may need to refresh its skill snapshot.
