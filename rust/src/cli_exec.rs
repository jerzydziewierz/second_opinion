use crate::config::Config;
use crate::logger::log_cli_debug;
use crate::models::ModelAlias;
use thiserror::Error;
use tokio::process::Command;

#[derive(Debug, Error)]
pub enum CliError {
    #[error("Failed to spawn {cli} CLI. Is it installed and in PATH? Error: {source}")]
    SpawnFailed {
        cli: &'static str,
        source: std::io::Error,
    },
    #[error("{cli} CLI exited with code {code}. Error: {stderr}")]
    NonZeroExit {
        cli: &'static str,
        code: i32,
        stderr: String,
    },
    #[error("Gemini quota exceeded. Consider using gemini-2.0-flash model. Error: {0}")]
    GeminiQuotaExhausted(String),
    #[error("No response from {0} CLI (empty stdout)")]
    EmptyResponse(&'static str),
}

struct CliSpec {
    bin: &'static str,
    args: Vec<String>,
    env_overrides: Vec<(&'static str, EnvAction)>,
}

enum EnvAction {
    Remove,
}

fn build_cli_spec(
    alias: ModelAlias,
    model: &str,
    full_prompt: &str,
    config: &Config,
) -> CliSpec {
    match alias {
        ModelAlias::Gemini => CliSpec {
            bin: "gemini",
            args: vec![
                "-m".into(),
                model.into(),
                "-p".into(),
                full_prompt.into(),
            ],
            env_overrides: vec![],
        },
        ModelAlias::Codex => {
            let mut args = vec![
                "exec".into(),
                "--skip-git-repo-check".into(),
                "-m".into(),
                model.into(),
            ];
            if let Some(ref effort) = config.codex_reasoning_effort {
                args.push("-c".into());
                args.push(format!("model_reasoning_effort=\"{effort}\""));
            }
            args.push(full_prompt.into());
            CliSpec {
                bin: "codex",
                args,
                env_overrides: vec![],
            }
        }
        ModelAlias::Claude => CliSpec {
            bin: "claude",
            args: vec![
                "--print".into(),
                "--model".into(),
                model.into(),
                full_prompt.into(),
            ],
            // Force subscription auth by removing API key
            env_overrides: vec![("ANTHROPIC_API_KEY", EnvAction::Remove)],
        },
        ModelAlias::Kilo => CliSpec {
            bin: "kilo",
            args: vec![
                "run".into(),
                "-m".into(),
                model.into(),
                full_prompt.into(),
            ],
            env_overrides: vec![],
        },
    }
}

pub async fn execute_cli(
    alias: ModelAlias,
    model: &str,
    full_prompt: &str,
    config: &Config,
) -> Result<String, CliError> {
    let spec = build_cli_spec(alias, model, full_prompt, config);

    log_cli_debug(&format!(
        "Spawning {} CLI: alias={}, model={}, prompt_len={}",
        spec.bin,
        alias,
        model,
        full_prompt.len()
    ));

    let mut cmd = Command::new(spec.bin);
    cmd.args(&spec.args);
    cmd.stdin(std::process::Stdio::null());
    cmd.stdout(std::process::Stdio::piped());
    cmd.stderr(std::process::Stdio::piped());

    // Apply env overrides
    for (key, action) in &spec.env_overrides {
        match action {
            EnvAction::Remove => {
                cmd.env_remove(key);
            }
        }
    }

    let start = std::time::Instant::now();

    let output = cmd.output().await.map_err(|e| CliError::SpawnFailed {
        cli: spec.bin,
        source: e,
    })?;

    let duration = start.elapsed();
    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();

    log_cli_debug(&format!(
        "{} CLI finished: code={:?}, duration={:?}, stdout_len={}, stderr_len={}",
        spec.bin,
        output.status.code(),
        duration,
        stdout.len(),
        stderr.len()
    ));

    if !output.status.success() {
        let code = output.status.code().unwrap_or(-1);

        // Special case: Gemini quota exhaustion
        if alias == ModelAlias::Gemini && stderr.contains("RESOURCE_EXHAUSTED") {
            return Err(CliError::GeminiQuotaExhausted(stderr.trim().to_string()));
        }

        return Err(CliError::NonZeroExit {
            cli: spec.bin,
            code,
            stderr: stderr.trim().to_string(),
        });
    }

    let trimmed = stdout.trim().to_string();
    if trimmed.is_empty() {
        return Err(CliError::EmptyResponse(spec.bin));
    }

    Ok(trimmed)
}
