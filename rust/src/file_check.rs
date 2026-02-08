use std::fs;
use std::path::Path;
use thiserror::Error;

const MAX_CONTEXT_FILE_BYTES: u64 = 200_000;

#[derive(Debug, Error)]
pub enum FileCheckError {
    #[error("File not found: {0}")]
    NotFound(String),
    #[error("File exceeds max context size ({MAX_CONTEXT_FILE_BYTES} bytes): {0}")]
    TooLarge(String),
    #[error("Binary file is not allowed in context: {0}")]
    Binary(String),
    #[error("Blocked sensitive file: {0}")]
    Sensitive(String),
    #[error("IO error reading {path}: {source}")]
    Io {
        path: String,
        source: std::io::Error,
    },
}

fn is_sensitive_path(path: &str) -> bool {
    let normalized = path.replace('\\', "/");
    let lower = normalized.to_lowercase();

    // .env, .env.local, .env.production, etc.
    if segment_matches(&lower, ".env") {
        return true;
    }
    // .git/ directory
    if lower.contains("/.git/") || lower.ends_with("/.git") || lower == ".git" {
        return true;
    }
    // .npmrc, .netrc
    if segment_matches(&lower, ".npmrc") || segment_matches(&lower, ".netrc") {
        return true;
    }
    // SSH keys
    for key_type in &["id_rsa", "id_dsa", "id_ecdsa", "id_ed25519"] {
        if segment_matches(&lower, key_type) {
            return true;
        }
    }
    // Cert/key files
    for ext in &[".pem", ".p12", ".pfx", ".key"] {
        if lower.ends_with(ext) {
            return true;
        }
    }

    false
}

/// Check if a filename segment matches (at end of path or after a `/`).
fn segment_matches(normalized_lower: &str, name: &str) -> bool {
    if normalized_lower == name {
        return true;
    }
    if normalized_lower.ends_with(&format!("/{name}")) {
        return true;
    }
    // Also match .env.* patterns
    if name == ".env" {
        // Check for .env.something
        if let Some(filename) = normalized_lower.rsplit('/').next() {
            if filename.starts_with(".env.") || filename == ".env" {
                return true;
            }
        } else if normalized_lower.starts_with(".env.") {
            return true;
        }
    }
    false
}

fn is_likely_binary(data: &[u8]) -> bool {
    let check_len = data.len().min(8192);
    data[..check_len].contains(&0)
}

pub fn validate_context_files(files: &[String]) -> Result<(), FileCheckError> {
    for file in files {
        let path = Path::new(file);

        // Canonicalize for sensitive-path check; fall back to the raw string
        let display_path = file.clone();

        if !path.exists() {
            return Err(FileCheckError::NotFound(display_path));
        }

        if is_sensitive_path(file) {
            let canonical = fs::canonicalize(path).unwrap_or_else(|_| path.to_path_buf());
            if is_sensitive_path(&canonical.to_string_lossy()) {
                return Err(FileCheckError::Sensitive(display_path));
            }
            // If only the original relative form matched, still block
            return Err(FileCheckError::Sensitive(display_path));
        }

        let meta = fs::metadata(path).map_err(|e| FileCheckError::Io {
            path: display_path.clone(),
            source: e,
        })?;

        if meta.len() > MAX_CONTEXT_FILE_BYTES {
            return Err(FileCheckError::TooLarge(display_path));
        }

        let content = fs::read(path).map_err(|e| FileCheckError::Io {
            path: display_path.clone(),
            source: e,
        })?;

        if is_likely_binary(&content) {
            return Err(FileCheckError::Binary(display_path));
        }
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sensitive_paths_detected() {
        assert!(is_sensitive_path(".env"));
        assert!(is_sensitive_path(".env.local"));
        assert!(is_sensitive_path("config/.env.production"));
        assert!(is_sensitive_path("project/.git/config"));
        assert!(is_sensitive_path(".npmrc"));
        assert!(is_sensitive_path("~/.netrc"));
        assert!(is_sensitive_path("keys/id_rsa"));
        assert!(is_sensitive_path("certs/server.pem"));
        assert!(is_sensitive_path("ssl/private.key"));
    }

    #[test]
    fn normal_paths_allowed() {
        assert!(!is_sensitive_path("src/main.rs"));
        assert!(!is_sensitive_path("README.md"));
        assert!(!is_sensitive_path("Cargo.toml"));
        assert!(!is_sensitive_path("tests/test_key_press.rs"));
    }

    #[test]
    fn binary_detection() {
        assert!(is_likely_binary(&[0x00, 0x01, 0x02]));
        assert!(!is_likely_binary(b"hello world\nfoo bar\n"));
    }
}
