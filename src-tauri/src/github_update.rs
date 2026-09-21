use serde::Serialize;
use std::{
    fs,
    path::{Path, PathBuf},
    process::{Command, Stdio},
};

const ARCHIVE_NAME: &str = "My Voice.app.zip";
const BUNDLE_ID: &str = "com.studiointhebox.myvoice";
const LATEST_URL: &str = "https://api.github.com/repos/filipego/my-voice/releases/latest";
const MAX_ARCHIVE_BYTES: u64 = 512 * 1024 * 1024;

#[derive(Debug, Clone, Serialize)]
pub struct AppUpdateOffer {
    pub version: String,
}

struct ReleaseCandidate {
    version: String,
    tag: String,
    archive_url: String,
    sha256: String,
    size: u64,
}

pub fn check_latest_release(current_version: &str) -> Result<Option<AppUpdateOffer>, String> {
    let candidate = match fetch_candidate()? {
        Some(candidate) => candidate,
        None => return Ok(None),
    };
    let current = parse_version(current_version).ok_or_else(|| "The installed version is invalid.".to_string())?;
    let offered = parse_version(&candidate.version).ok_or_else(|| "The release tag is invalid.".to_string())?;
    if offered <= current {
        return Ok(None);
    }
    Ok(Some(AppUpdateOffer {
        version: candidate.version,
    }))
}

pub fn install_latest_release(current_version: &str) -> Result<(), String> {
    let candidate = fetch_candidate()?.ok_or_else(|| "My Voice is already up to date.".to_string())?;
    let current = parse_version(current_version).ok_or_else(|| "The installed version is invalid.".to_string())?;
    let offered = parse_version(&candidate.version).ok_or_else(|| "The release tag is invalid.".to_string())?;
    if offered <= current {
        return Err("My Voice is already up to date.".to_string());
    }

    let inbox = std::env::temp_dir().join(format!(
        "my-voice-update-{}",
        candidate.tag.replace(['/', '+'], "-")
    ));
    let _ = fs::remove_dir_all(&inbox);
    fs::create_dir_all(&inbox).map_err(|error| error.to_string())?;
    let archive_path = inbox.join(ARCHIVE_NAME);
    download_file(&candidate.archive_url, &archive_path)?;
    let actual_size = fs::metadata(&archive_path).map_err(|error| error.to_string())?.len();
    if actual_size != candidate.size {
        return Err("The release archive size does not match GitHub.".to_string());
    }
    verify_sha256(&archive_path, &candidate.sha256)?;

    let extracted = inbox.join("extracted");
    fs::create_dir_all(&extracted).map_err(|error| error.to_string())?;
    let status = Command::new("ditto")
        .args([
            "-x",
            "-k",
            &path_string(&archive_path)?,
            &path_string(&extracted)?,
        ])
        .status()
        .map_err(|error| error.to_string())?;
    if !status.success() {
        return Err("The release archive could not be opened.".to_string());
    }
    let staged = extracted.join("My Voice.app");
    if !staged.is_dir() {
        return Err("The release archive does not contain My Voice.app.".to_string());
    }
    let plist = staged.join("Contents/Info.plist");
    let identifier = plist_value(&plist, "CFBundleIdentifier")?;
    let bundled_version = plist_value(&plist, "CFBundleShortVersionString")?;
    if identifier != BUNDLE_ID {
        return Err("The release app identity does not match My Voice.".to_string());
    }
    if bundled_version != candidate.version {
        return Err("The release app version does not match its tag.".to_string());
    }

    swap_and_relaunch(&staged, &installed_app_bundle()?)?;
    Ok(())
}

fn fetch_candidate() -> Result<Option<ReleaseCandidate>, String> {
    let body = http_bytes(LATEST_URL)?;
    let release: serde_json::Value = serde_json::from_slice(&body)
        .map_err(|_| "GitHub returned invalid release metadata.".to_string())?;
    if release.get("draft").and_then(|value| value.as_bool()) == Some(true) {
        return Err("The latest GitHub release is still a draft.".to_string());
    }
    if release.get("prerelease").and_then(|value| value.as_bool()) == Some(true) {
        return Err("The latest GitHub release is a prerelease.".to_string());
    }
    let tag = release
        .get("tag_name")
        .and_then(|value| value.as_str())
        .ok_or_else(|| "The release tag is invalid.".to_string())?;
    let version = version_from_tag(tag).ok_or_else(|| "The release tag is invalid.".to_string())?;
    let assets = release
        .get("assets")
        .and_then(|value| value.as_array())
        .ok_or_else(|| "The release archive is missing.".to_string())?;
    let archives: Vec<_> = assets
        .iter()
        .filter(|asset| asset.get("name").and_then(|value| value.as_str()) == Some(ARCHIVE_NAME))
        .collect();
    if archives.is_empty() {
        return Err("The release archive is missing.".to_string());
    }
    if archives.len() != 1 {
        return Err("The release contains duplicate archives.".to_string());
    }
    let asset = archives[0];
    if asset.get("state").and_then(|value| value.as_str()) != Some("uploaded") {
        return Err("The release archive is not ready.".to_string());
    }
    let size = asset.get("size").and_then(|value| value.as_u64()).unwrap_or(0);
    if size == 0 || size > MAX_ARCHIVE_BYTES {
        return Err("The release archive size is invalid.".to_string());
    }
    let digest = asset
        .get("digest")
        .and_then(|value| value.as_str())
        .ok_or_else(|| "The release archive digest is missing.".to_string())?;
    let sha256 = digest
        .strip_prefix("sha256:")
        .ok_or_else(|| "The release archive digest is invalid.".to_string())?;
    if sha256.len() != 64 || !sha256.chars().all(|character| character.is_ascii_hexdigit()) {
        return Err("The release archive digest is invalid.".to_string());
    }
    let archive_url = asset
        .get("browser_download_url")
        .and_then(|value| value.as_str())
        .ok_or_else(|| "The release archive URL is invalid.".to_string())?;
    require_release_download_url(archive_url, tag)?;
    Ok(Some(ReleaseCandidate {
        version,
        tag: tag.to_string(),
        archive_url: archive_url.to_string(),
        sha256: sha256.to_ascii_lowercase(),
        size,
    }))
}

fn version_from_tag(tag: &str) -> Option<String> {
    let rest = tag.strip_prefix('v').unwrap_or(tag);
    let marketing = rest.split('+').next().unwrap_or(rest);
    parse_version(marketing).map(|(major, minor, patch)| format!("{major}.{minor}.{patch}"))
}

fn parse_version(value: &str) -> Option<(u64, u64, u64)> {
    let mut parts = value.split('.');
    let major = parts.next()?.parse().ok()?;
    let minor = parts.next()?.parse().ok()?;
    let patch = parts.next()?.parse().ok()?;
    if parts.next().is_some() {
        return None;
    }
    Some((major, minor, patch))
}

fn require_release_download_url(url: &str, tag: &str) -> Result<(), String> {
    let rest = url.strip_prefix("https://github.com/filipego/my-voice/releases/download/")
        .ok_or_else(|| "The release archive URL is invalid.".to_string())?;
    let (url_tag, file_name) = rest
        .split_once('/')
        .ok_or_else(|| "The release archive URL is invalid.".to_string())?;
    if url_tag != tag {
        return Err("The release archive tag does not match.".to_string());
    }
    let decoded = file_name.replace("%20", " ");
    if decoded != ARCHIVE_NAME || file_name.contains('/') || file_name.contains('?') || file_name.contains('#') {
        return Err("The release archive filename is invalid.".to_string());
    }
    Ok(())
}

fn http_bytes(url: &str) -> Result<Vec<u8>, String> {
    let output = Command::new("curl")
        .args([
            "-fsSL",
            "--max-time",
            "30",
            "-A",
            "MyVoice",
            "-H",
            "Accept: application/vnd.github+json",
            url,
        ])
        .output()
        .map_err(|error| error.to_string())?;
    if output.status.success() {
        return Ok(output.stdout);
    }
    let detail = String::from_utf8_lossy(&output.stderr);
    if detail.contains("404") {
        return Err("No published release yet.".to_string());
    }
    Err(if detail.trim().is_empty() {
        "Could not reach GitHub.".to_string()
    } else {
        detail.trim().to_string()
    })
}

fn download_file(url: &str, destination: &Path) -> Result<(), String> {
    let status = Command::new("curl")
        .args([
            "-fL",
            "--max-time",
            "180",
            "-A",
            "MyVoice",
            "-o",
            &path_string(destination)?,
            url,
        ])
        .status()
        .map_err(|error| error.to_string())?;
    if status.success() {
        Ok(())
    } else {
        Err("The release archive could not be downloaded.".to_string())
    }
}

fn verify_sha256(archive: &Path, expected: &str) -> Result<(), String> {
    let output = Command::new("shasum")
        .args(["-a", "256", &path_string(archive)?])
        .output()
        .map_err(|error| error.to_string())?;
    if !output.status.success() {
        return Err("The release archive digest could not be checked.".to_string());
    }
    let actual = String::from_utf8_lossy(&output.stdout)
        .split_whitespace()
        .next()
        .unwrap_or("")
        .to_ascii_lowercase();
    if actual == expected {
        Ok(())
    } else {
        Err("The release archive digest does not match.".to_string())
    }
}

fn plist_value(plist: &Path, key: &str) -> Result<String, String> {
    let output = Command::new("plutil")
        .args(["-extract", key, "raw", "-o", "-", &path_string(plist)?])
        .output()
        .map_err(|error| error.to_string())?;
    if !output.status.success() {
        return Err("The release app identity could not be read.".to_string());
    }
    Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
}

fn installed_app_bundle() -> Result<PathBuf, String> {
    let exe = std::env::current_exe().map_err(|error| error.to_string())?;
    exe.parent()
        .and_then(|path| path.parent())
        .and_then(|path| path.parent())
        .filter(|path| path.extension().and_then(|ext| ext.to_str()) == Some("app"))
        .map(Path::to_path_buf)
        .ok_or_else(|| "My Voice could not find its installed app.".to_string())
}

fn swap_and_relaunch(staged: &Path, target: &Path) -> Result<(), String> {
    let script_path = staged.parent().unwrap_or(staged).join("install-my-voice.sh");
    let script = format!(
        "while kill -0 {pid} 2>/dev/null; do sleep 0.2; done\nsleep 0.4\nrm -rf {target}\nditto {staged} {target}\nopen {target}\n",
        pid = std::process::id(),
        target = shell_quote(target),
        staged = shell_quote(staged),
    );
    fs::write(&script_path, script).map_err(|error| error.to_string())?;
    Command::new("sh")
        .arg("-c")
        .arg(format!(
            "nohup sh {} >/dev/null 2>&1 &",
            shell_quote(&script_path)
        ))
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .map_err(|error| error.to_string())?;
    Ok(())
}

fn path_string(path: &Path) -> Result<String, String> {
    path.to_str()
        .map(str::to_string)
        .ok_or_else(|| "A file path could not be read.".to_string())
}

fn shell_quote(path: &Path) -> String {
    format!("'{}'", path.to_string_lossy().replace('\'', "'\\''"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn tags_parse_and_compare() {
        assert_eq!(version_from_tag("v0.1.4"), Some("0.1.4".to_string()));
        assert_eq!(version_from_tag("v0.1.4+4"), Some("0.1.4".to_string()));
        assert!(parse_version("0.1.4").unwrap() > parse_version("0.1.3").unwrap());
        assert!(version_from_tag("not-a-version").is_none());
    }

    #[test]
    fn download_urls_stay_on_this_repository() {
        assert!(require_release_download_url(
            "https://github.com/filipego/my-voice/releases/download/v0.1.4/My%20Voice.app.zip",
            "v0.1.4"
        )
        .is_ok());
        assert!(require_release_download_url(
            "https://example.com/filipego/my-voice/releases/download/v0.1.4/My%20Voice.app.zip",
            "v0.1.4"
        )
        .is_err());
        assert!(require_release_download_url(
            "https://github.com/filipego/my-voice/releases/download/v0.1.3/My%20Voice.app.zip",
            "v0.1.4"
        )
        .is_err());
    }
}
