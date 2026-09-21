# My Voice updates

My Voice uses the Tauri updater to check the latest signed GitHub release. The app checks once when it opens and exposes **Check for updates** in the upper-right header. When a newer release is available, the same control becomes **Update to v…**; installing downloads the signed artifact and relaunches the app.

## One-time GitHub setup

1. Keep the private updater key generated for this repository outside Git. The local setup writes it to `/private/tmp/my-voice-updater.key`; do not commit it.
2. In the repository settings, add an Actions secret named `TAURI_SIGNING_PRIVATE_KEY` containing the full contents of that file. The generated key has no password, so `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` can be left unset (or set to an empty value).
3. Keep the public key in `src-tauri/tauri.conf.json`. It is safe to commit and lets installed apps verify release artifacts.

## Publishing a release

1. Bump the version in `package.json`, `src-tauri/Cargo.toml`, and `src-tauri/tauri.conf.json` together.
2. Commit the release and push a tag with the same version, for example `v0.1.1`.
3. The `Release My Voice` workflow builds Apple Silicon and Intel macOS artifacts and publishes the signed `latest.json` manifest to that GitHub release.

The updater endpoint is intentionally fixed to the repository's latest GitHub release, so a person using a copy in `/Applications` does not need to know where the artifacts are stored.
