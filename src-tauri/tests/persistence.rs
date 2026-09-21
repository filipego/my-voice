use my_voice_lib::{AppState, Database};
use tempfile::TempDir;

#[test]
fn database_round_trips_voice_state() {
    let dir = TempDir::new().expect("temp directory");
    let path = dir.path().join("my-voice.db");
    let database = Database::open(&path).expect("database opens");

    let loaded = database.load_state().expect("initial state loads");
    assert_eq!(loaded.profile["rules"], serde_json::json!([]));
    assert_eq!(loaded.profile["versions"], serde_json::json!([]));
    assert_eq!(loaded.profile["currentVersion"], 0);
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

#[test]
fn unsupported_storage_version_cannot_be_loaded_or_overwritten() {
    let dir = TempDir::new().expect("temp directory");
    let path = dir.path().join("my-voice.db");

    let database = Database::open(&path).expect("database opens");
    drop(database);

    let wrapped = serde_json::json!({"futurePayload": "requires a newer schema"});
    let connection = rusqlite::Connection::open(&path).expect("raw database opens");
    connection
        .execute(
            "INSERT INTO voice_state (id, storage_version, state) VALUES (1, 2, ?1)",
            rusqlite::params![wrapped.to_string()],
        )
        .expect("future state seeds");
    drop(connection);

    let database = Database::open(&path).expect("database reopens");
    assert_eq!(
        database.load_state().expect_err("future version must reject"),
        "unsupported storage version: 2"
    );
    assert_eq!(
        database
        .save_state(AppState {
            profile: serde_json::json!({"voiceName": "Current Voice"}),
            sources: serde_json::json!([]),
        })
        .expect_err("future version must not be overwritten"),
        "unsupported storage version: 2"
    );
    drop(database);

    let connection = rusqlite::Connection::open(&path).expect("raw database reopens");
    let (storage_version, state): (u32, String) = connection
        .query_row(
            "SELECT storage_version, state FROM voice_state WHERE id = 1",
            [],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .expect("future state remains");
    assert_eq!(storage_version, 2);
    assert_eq!(state, wrapped.to_string());
}
