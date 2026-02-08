use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fmt;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "lowercase")]
pub enum ModelAlias {
    Gemini,
    Claude,
    Codex,
    Kilo,
}

impl ModelAlias {
    pub const ALL: &[ModelAlias] = &[
        ModelAlias::Gemini,
        ModelAlias::Claude,
        ModelAlias::Codex,
        ModelAlias::Kilo,
    ];
}

impl fmt::Display for ModelAlias {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            ModelAlias::Gemini => write!(f, "gemini"),
            ModelAlias::Claude => write!(f, "claude"),
            ModelAlias::Codex => write!(f, "codex"),
            ModelAlias::Kilo => write!(f, "kilo"),
        }
    }
}

pub const DEFAULT_ALIAS: ModelAlias = ModelAlias::Gemini;

pub fn default_model_mapping() -> HashMap<ModelAlias, String> {
    HashMap::from([
        (ModelAlias::Gemini, "gemini-3-pro-preview".into()),
        (ModelAlias::Claude, "claude-opus-4-6".into()),
        (ModelAlias::Codex, "gpt-5.3-codex".into()),
        (ModelAlias::Kilo, "openrouter/moonshotai/kimi-k2.5".into()),
    ])
}
