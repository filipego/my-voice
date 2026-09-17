use my_voice_lib::{AppState, Database};
use tempfile::TempDir;

#[test]
fn database_round_trips_voice_state() {
    let dir = TempDir::new().expect("temp directory");
    let path = dir.path().join("my-voice.db");
    let database = Database::open(&path).expect("database opens");

    let loaded = database.load_state().expect("initial state loads");
    assert_eq!(loaded.profile["currentVersion"], 1);
    assert_eq!(loaded.sources.as_array().map(Vec::len), Some(0));

    let profile = serde_json::json!({"currentVersion": 7});
    let sources = serde_json::json!({"lastSavedAt": "2026-09-16T21:00:00Z"});
    let state = AppState { profile, sources };

    database.save_state(state).expect("state saves");
    let reloaded = database.load_state().expect("state reloads");
    assert_eq!(reloaded.profile["currentVersion"], 7);
    assert_eq!(reloaded.sources["lastSavedAt"], "2026-09-16T21:00:00Z");
}

#[test]
fn database_persists_across_reopening_the_file() {
    let dir = TempDir::new().expect("temp directory");
    let path = dir.path().join("my-voice.db");

    let first = Database::open(&path).expect("first database opens");
    let state = AppState {
        profile: serde_json::json!({"voiceName": "Filipe"}),
        sources: serde_json::json!([{"id": "source-1"}]),
    };
    first.save_state(state).expect("state saves");

    let second = Database::open(&path).expect("second database opens");
    let reloaded = second.load_state().expect("state reloads");
    assert_eq!(reloaded.profile["voiceName"], "Filipe");
    assert_eq!(reloaded.sources[0]["id"], "source-1");
}
