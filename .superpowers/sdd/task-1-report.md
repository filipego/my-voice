# Task 1 report: Repair and migrate persisted state

## Files changed

- `src/core/storage.ts` — added the exported `normalizeAppState` boundary and applied it to native/local persistence loads and parse fallbacks.
- `tests/storage.test.ts` — added coverage for a persisted profile missing `rules` and `versions`.
- `src-tauri/src/lib.rs` — changed the empty database state to the complete profile schema (`rules`, `versions`, `currentVersion: 0`, and `sources`). Existing unsupported storage-version rejection remains intact and returns an error without writing.
- `src-tauri/tests/persistence.rs` — asserts the complete empty database schema.

## Tests and outputs

- Red phase: `npm test -- tests/storage.test.ts` initially could not start because dependencies were absent (`sh: vitest: command not found`). After installing the pinned dependencies, the new implementation test passed.
- Red phase: `cargo test --manifest-path src-tauri/Cargo.toml --test persistence` failed as expected before implementation: empty profile `rules` was `Null` instead of `[]`.
- Green: `npm test -- tests/storage.test.ts` — 1 file, 5 tests passed.
- Green: `cargo test --manifest-path src-tauri/Cargo.toml --test persistence` — 2 tests passed, 0 failed.

## Acceptance mapping

- TypeScript migration test added and passes; missing arrays are filled while valid `currentVersion`, sources, and complete states are preserved.
- Rust empty-state test added and passes against the complete schema.
- A single normalization boundary is used by `loadState` for both native and browser persistence paths.
- Rust rejects unsupported future storage versions before returning state and does not overwrite stored data.
- Both exact focused commands pass.

## Concerns

- `npm install` reported 5 existing dependency audit findings (3 moderate, 1 high, 1 critical); dependency versions were not changed.
