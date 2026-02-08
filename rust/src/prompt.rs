use std::path::Path;

/// Build the full prompt sent to the CLI.
///
/// The file *paths* are appended as `@relative/path` references — the CLIs
/// themselves read the files.  We never load file contents into memory here.
pub fn build_full_prompt(
    system_prompt: &str,
    user_prompt: &str,
    file_paths: Option<&[String]>,
    git_diff: Option<&str>,
) -> String {
    let mut parts = Vec::with_capacity(4);

    parts.push(system_prompt.to_string());

    if let Some(diff) = git_diff {
        if !diff.trim().is_empty() {
            parts.push(format!("## Git Diff\n```diff\n{diff}\n```"));
        }
    }

    parts.push(user_prompt.to_string());

    if let Some(paths) = file_paths {
        if !paths.is_empty() {
            let cwd = std::env::current_dir().unwrap_or_default();
            let refs: Vec<String> = paths
                .iter()
                .map(|p| {
                    let rel = relative_path(p, &cwd);
                    format!("@{rel}")
                })
                .collect();
            parts.push(format!("Files: {}", refs.join(" ")));
        }
    }

    parts.join("\n\n")
}

/// Simple relative-path computation. Falls back to the original path
/// if canonicalization fails or the paths share no common prefix.
fn relative_path(path: &str, base: &Path) -> String {
    let abs_path = std::fs::canonicalize(path)
        .unwrap_or_else(|_| std::path::PathBuf::from(path));
    let abs_base = std::fs::canonicalize(base)
        .unwrap_or_else(|_| base.to_path_buf());

    let path_parts: Vec<_> = abs_path.components().collect();
    let base_parts: Vec<_> = abs_base.components().collect();

    // Find common prefix length
    let common = path_parts
        .iter()
        .zip(base_parts.iter())
        .take_while(|(a, b)| a == b)
        .count();

    if common == 0 {
        return path.to_string();
    }

    let mut result = std::path::PathBuf::new();
    for _ in common..base_parts.len() {
        result.push("..");
    }
    for part in &path_parts[common..] {
        result.push(part);
    }

    let s = result.to_string_lossy().into_owned();
    if s.is_empty() {
        ".".to_string()
    } else {
        s
    }
}
