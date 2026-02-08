use rmcp::handler::server::router::tool::ToolRouter;
use rmcp::handler::server::wrapper::Parameters;
use rmcp::model::{
    CallToolResult, Content, Implementation, ServerCapabilities, ServerInfo,
};
use schemars::JsonSchema;
use rmcp::{tool, tool_handler, tool_router, ServerHandler};
use serde::Deserialize;

use crate::cli_exec::execute_cli;
use crate::config::Config;
use crate::file_check::validate_context_files;
use crate::git_diff::generate_git_diff;
use crate::logger::{log_prompt, log_response, log_tool_call};
use crate::prompt::build_full_prompt;
use crate::system_prompt::get_system_prompt;

pub const SERVER_VERSION: &str = env!("CARGO_PKG_VERSION");

/// Git diff parameters.
#[derive(Debug, Deserialize, JsonSchema)]
pub struct GitDiffParams {
    /// Path to git repository (defaults to current working directory)
    #[serde(default)]
    pub repo_path: Option<String>,
    /// Specific files to include in diff
    pub files: Vec<String>,
    /// Git reference to compare against (e.g., "HEAD", "main", commit hash)
    #[serde(default = "default_base_ref")]
    pub base_ref: String,
}

fn default_base_ref() -> String {
    "HEAD".to_string()
}

/// Arguments for the `consult` tool.
#[derive(Debug, Deserialize, JsonSchema)]
pub struct ConsultArgs {
    /// Your question or request for the consultant LLM. Ask neutral, open-ended
    /// questions without suggesting specific solutions to avoid biasing the analysis.
    pub prompt: String,

    /// LLM model to use. One of "gemini", "claude", "codex", or "kilo".
    #[serde(default)]
    pub model: Option<String>,

    /// Array of file paths to include as context.
    #[serde(default)]
    pub files: Option<Vec<String>>,

    /// Generate git diff output to include as context.
    #[serde(default)]
    pub git_diff: Option<GitDiffParams>,
}

#[derive(Clone)]
pub struct SecondOpinionServer {
    config: Config,
    tool_router: ToolRouter<Self>,
}

#[tool_router]
impl SecondOpinionServer {
    pub fn new(config: Config) -> Self {
        let tool_router = Self::tool_router();
        Self {
            config,
            tool_router,
        }
    }

    /// Ask a second, different AI for help with the problem at hand.
    #[tool(description = "Ask a second, different AI for help with the problem at hand. It might have an original idea or approach that you did not think about so far. Provide your question in the prompt field and always include relevant code files as context.\n\nBe specific about what you want: architecture advice, code implementation, document review, bug research, or anything else.\n\nIMPORTANT: Ask neutral, open-ended questions. Avoid suggesting specific solutions or alternatives in your prompt as this can bias the analysis. Instead of \"Should I use X or Y approach?\", ask \"What's the best approach for this problem?\" Let the consultant LLM provide unbiased recommendations.")]
    async fn consult(
        &self,
        Parameters(args): Parameters<ConsultArgs>,
    ) -> Result<CallToolResult, rmcp::ErrorData> {
        // Log the tool call
        let args_json = serde_json::to_string_pretty(&serde_json::json!({
            "prompt": &args.prompt,
            "model": &args.model,
            "files": &args.files,
            "git_diff": args.git_diff.as_ref().map(|d| serde_json::json!({
                "repo_path": &d.repo_path,
                "files": &d.files,
                "base_ref": &d.base_ref,
            })),
        }))
        .unwrap_or_default();
        log_tool_call("consult", &args_json);

        // Resolve model alias
        let default_alias_str = self.config.default_alias.to_string();
        let alias_str = args.model.as_deref().unwrap_or(&default_alias_str);
        let alias = match alias_str {
            "gemini" => crate::models::ModelAlias::Gemini,
            "claude" => crate::models::ModelAlias::Claude,
            "codex" => crate::models::ModelAlias::Codex,
            "kilo" => crate::models::ModelAlias::Kilo,
            other => {
                return Ok(CallToolResult::error(vec![Content::text(format!(
                    "Unknown model alias: {other}. Use one of: gemini, claude, codex, kilo"
                ))]));
            }
        };

        let model_name = self
            .config
            .models
            .get(&alias)
            .cloned()
            .unwrap_or_else(|| alias.to_string());

        // Validate context files if provided
        if let Some(ref files) = args.files {
            if !files.is_empty() {
                if let Err(e) = validate_context_files(files) {
                    return Ok(CallToolResult::error(vec![Content::text(format!(
                        "File validation error: {e}"
                    ))]));
                }
            }
        }

        // Generate git diff if requested
        let git_diff_output = if let Some(ref diff_params) = args.git_diff {
            match generate_git_diff(
                diff_params.repo_path.as_deref(),
                &diff_params.files,
                &diff_params.base_ref,
            ) {
                Ok(diff) => Some(diff),
                Err(e) => {
                    return Ok(CallToolResult::error(vec![Content::text(format!(
                        "Git diff failed: {e}"
                    ))]));
                }
            }
        } else {
            None
        };

        // Build full prompt
        let system_prompt = get_system_prompt(&self.config.system_prompt_path);
        let full_prompt = build_full_prompt(
            &system_prompt,
            &args.prompt,
            args.files.as_deref(),
            git_diff_output.as_deref(),
        );

        log_prompt(&alias.to_string(), &full_prompt);

        // Execute CLI
        match execute_cli(alias, &model_name, &full_prompt, &self.config).await {
            Ok(response) => {
                log_response(&alias.to_string(), &response);
                Ok(CallToolResult::success(vec![Content::text(response)]))
            }
            Err(e) => Ok(CallToolResult::error(vec![Content::text(format!(
                "LLM query failed: {e}"
            ))])),
        }
    }
}

#[tool_handler]
impl ServerHandler for SecondOpinionServer {
    fn get_info(&self) -> ServerInfo {
        ServerInfo {
            protocol_version: Default::default(),
            capabilities: ServerCapabilities::builder().enable_tools().build(),
            server_info: Implementation {
                name: "grey_rso".into(),
                version: SERVER_VERSION.into(),
                title: Some("Second Opinion MCP (Rust)".into()),
                icons: None,
                website_url: None,
            },
            instructions: Some(
                "Second Opinion MCP server — consult a different AI coding assistant.".into(),
            ),
        }
    }
}
