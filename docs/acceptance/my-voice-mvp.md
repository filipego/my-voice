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

## Not claimed complete

- A launched, installed macOS desktop run through the complete workflow was not available in this acceptance pass.
- Codex area/version selection was not independently proven against a live discovered Codex session; publication reports reload/unverified guidance honestly.
