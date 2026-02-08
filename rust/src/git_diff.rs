use std::process::Command;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum GitDiffError {
    #[error("No files specified for git diff")]
    NoFiles,
    #[error("Invalid git ref: {0}")]
    InvalidRef(String),
    #[error("Invalid file path: {0}")]
    InvalidPath(String),
    #[error("git diff failed: {0}")]
    CommandFailed(String),
}

fn validate_ref(git_ref: &str) -> Result<(), GitDiffError> {
    if git_ref.starts_with('-') {
        return Err(GitDiffError::InvalidRef(git_ref.to_string()));
    }
    let valid = git_ref
        .chars()
        .all(|c| c.is_ascii_alphanumeric() || "_./-~^{}".contains(c));
    if !valid {
        return Err(GitDiffError::InvalidRef(git_ref.to_string()));
    }
    Ok(())
}

fn validate_file_path(path: &str) -> Result<(), GitDiffError> {
    if path.starts_with('-') {
        return Err(GitDiffError::InvalidPath(path.to_string()));
    }
    let has_unsafe = path.chars().any(|c| ";|&$`\\(){}<>!#'\"".contains(c));
    if has_unsafe {
        return Err(GitDiffError::InvalidPath(path.to_string()));
    }
    Ok(())
}

pub fn generate_git_diff(
    repo_path: Option<&str>,
    files: &[String],
    base_ref: &str,
) -> Result<String, GitDiffError> {
    if files.is_empty() {
        return Err(GitDiffError::NoFiles);
    }

    validate_ref(base_ref)?;
    for f in files {
        validate_file_path(f)?;
    }

    let cwd = match repo_path {
        Some(p) => p.to_string(),
        None => std::env::current_dir()
            .map(|p| p.to_string_lossy().into_owned())
            .unwrap_or_else(|_| ".".to_string()),
    };

    let mut cmd = Command::new("git");
    cmd.arg("diff").arg(base_ref).arg("--");
    for f in files {
        cmd.arg(f);
    }
    cmd.current_dir(&cwd);

    let output = cmd
        .output()
        .map_err(|e| GitDiffError::CommandFailed(e.to_string()))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(GitDiffError::CommandFailed(stderr.to_string()));
    }

    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reject_bad_refs() {
        assert!(validate_ref("-evil").is_err());
        assert!(validate_ref("HEAD;rm -rf /").is_err());
        assert!(validate_ref("HEAD").is_ok());
        assert!(validate_ref("main").is_ok());
        assert!(validate_ref("abc123").is_ok());
        assert!(validate_ref("origin/main").is_ok());
    }

    #[test]
    fn reject_bad_paths() {
        assert!(validate_file_path("-flag").is_err());
        assert!(validate_file_path("file;rm").is_err());
        assert!(validate_file_path("src/main.rs").is_ok());
    }

    #[test]
    fn empty_files_rejected() {
        let result = generate_git_diff(None, &[], "HEAD");
        assert!(result.is_err());
    }
}
