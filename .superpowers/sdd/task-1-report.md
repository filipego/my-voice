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

## Fix: preserve unsupported voice state versions

### Files changed

- `src/core/storage.ts` — replaced the broad partial-state cast with record narrowing, preserved valid normalized profile fields, and rethrew unsupported native storage-version errors instead of silently returning an empty state.
- `tests/storage.test.ts` — added a regression for surfacing an unsupported native storage version; adjusted the native round-trip assertion to verify normalized value equality.
- `src-tauri/src/lib.rs` — checks an existing row's storage version before upsert and rejects future versions without modifying the row.
- `src-tauri/tests/persistence.rs` — seeds a version-2 row, verifies load/save both reject, and verifies the original version and JSON remain unchanged.

### Tests

- Red: `npm test -- tests/storage.test.ts` failed on the new unsupported-version test because `loadState` swallowed the error.
- Red: `cargo test --manifest-path src-tauri/Cargo.toml --test persistence` failed because `save_state` overwrote the seeded version-2 row.
- Green: `npm run typecheck` — passed.
- Green: `npm test -- tests/storage.test.ts` — 6 tests passed.
- Green: `cargo test --manifest-path src-tauri/Cargo.toml --test persistence` — 3 tests passed.

### Concerns

- The normalized boundary still treats persisted rule/version array entries as domain values after checking their array shape; deeper per-entry schema validation is outside this focused Task 1 fix.

## Review resolution: reject incompatible future payloads

- `src-tauri/src/lib.rs` now reads the SQL `storage_version` column before deserializing the stored JSON, so an incompatible future payload still returns `unsupported storage version: 2`.
- `src-tauri/tests/persistence.rs` seeds version 2 with a payload that omits the current schema fields, asserts both load and save reject with the explicit version error, and verifies the original bytes and version remain unchanged.
- Validation: `cargo test --manifest-path src-tauri/Cargo.toml --test persistence` (3 passed), `npm run typecheck` (passed), and `npm test -- tests/storage.test.ts` (6 passed).
