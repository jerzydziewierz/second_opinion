use crate::models::{default_model_mapping, ModelAlias, DEFAULT_ALIAS};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;

/// On-disk JSON shape — uses string keys for the models map so the config file
/// stays human-readable (`"gemini": "gemini-3-pro-preview"` etc.).
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RawConfig {
    #[serde(default)]
    models: HashMap<ModelAlias, String>,
    #[serde(default)]
    default_alias: Option<ModelAlias>,
    #[serde(default)]
    codex_reasoning_effort: Option<String>,
    #[serde(default)]
    system_prompt_path: Option<String>,
}

#[derive(Debug, Clone)]
pub struct Config {
    pub models: HashMap<ModelAlias, String>,
    pub default_alias: ModelAlias,
    pub codex_reasoning_effort: Option<String>,
    pub system_prompt_path: PathBuf,
}

pub fn config_dir() -> PathBuf {
    dirs::home_dir()
        .expect("cannot determine home directory")
        .join(".config")
        .join("grey-rso")
}

fn config_path() -> PathBuf {
    config_dir().join("config.json")
}

fn write_default_config(path: &PathBuf) {
    let defaults = default_model_mapping();
    let raw = RawConfig {
        models: defaults,
        default_alias: Some(DEFAULT_ALIAS),
        codex_reasoning_effort: None,
        system_prompt_path: None,
    };
    if let Some(parent) = path.parent() {
        let _ = fs::create_dir_all(parent);
    }
    let json = serde_json::to_string_pretty(&raw).expect("serialize default config");
    let _ = fs::write(path, json);
}

pub fn load_config() -> Config {
    let path = config_path();
    let dir = config_dir();

    if !path.exists() {
        write_default_config(&path);
    }

    let raw: RawConfig = match fs::read_to_string(&path) {
        Ok(contents) => match serde_json::from_str(&contents) {
            Ok(c) => c,
            Err(_) => {
                write_default_config(&path);
                serde_json::from_str(
                    &fs::read_to_string(&path).expect("re-read default config"),
                )
                .expect("parse default config")
            }
        },
        Err(_) => {
            write_default_config(&path);
            serde_json::from_str(
                &fs::read_to_string(&path).expect("re-read default config"),
            )
            .expect("parse default config")
        }
    };

    // Merge with defaults — ensure every alias has a model
    let mut models = default_model_mapping();
    for (alias, model) in raw.models {
        models.insert(alias, model);
    }

    let default_alias = raw.default_alias.unwrap_or(DEFAULT_ALIAS);

    let system_prompt_path = match raw.system_prompt_path {
        Some(p) => PathBuf::from(p),
        None => dir.join("SYSTEM_PROMPT.md"),
    };

    Config {
        models,
        default_alias,
        codex_reasoning_effort: raw.codex_reasoning_effort,
        system_prompt_path,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn default_config_has_all_aliases() {
        let models = default_model_mapping();
        for alias in ModelAlias::ALL {
            assert!(models.contains_key(alias), "missing alias {alias}");
        }
    }
}
