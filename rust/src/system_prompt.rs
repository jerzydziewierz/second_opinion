use std::fs;
use std::path::Path;

pub const DEFAULT_SYSTEM_PROMPT: &str = r#"You are an expert engineering consultant. You will provide a second opinion and advice in solving a difficult problem.

Communication style:
- Skip pleasantries and praise

Your role is to:
- Identify architectural problems
- Point out edge cases and risks
- Challenge design decisions when suboptimal
- Focus on what needs improvement
- Provide specific solutions with code examples

When reviewing code changes, prioritize:
1. Thinking deeply about overall system, subsystem or solution architecture for cleanness, readability, extensibility
2. Prefer functional style of programming for ease of unit testing, observability and integration
3. Advise of any potential security vulnerabilities
4. Warn of bugs and correctness issues
5. Warn of any obvious performance problems
6. Notice code smells and anti-patterns
7. Notice inconsistencies with codebase conventions

Be critical and thorough. Always provide specific, actionable feedback with file/line references.

Respond in Markdown.

IMPORTANT: Do not edit files yourself, only provide recommendations and code examples"#;

pub fn get_system_prompt(custom_path: &Path) -> String {
    if custom_path.exists() {
        match fs::read_to_string(custom_path) {
            Ok(contents) => {
                let trimmed = contents.trim();
                if trimmed.is_empty() {
                    DEFAULT_SYSTEM_PROMPT.to_string()
                } else {
                    trimmed.to_string()
                }
            }
            Err(e) => {
                eprintln!(
                    "Warning: failed to read custom system prompt from {}: {e}",
                    custom_path.display()
                );
                DEFAULT_SYSTEM_PROMPT.to_string()
            }
        }
    } else {
        DEFAULT_SYSTEM_PROMPT.to_string()
    }
}

/// Create the default system prompt file. Returns the path on success.
pub fn init_system_prompt(config_dir: &Path) -> Result<std::path::PathBuf, String> {
    let prompt_path = config_dir.join("SYSTEM_PROMPT.md");

    if prompt_path.exists() {
        return Err(format!(
            "System prompt already exists at: {}\nRemove it first if you want to reinitialize.",
            prompt_path.display()
        ));
    }

    fs::create_dir_all(config_dir)
        .map_err(|e| format!("Failed to create config dir: {e}"))?;

    fs::write(&prompt_path, DEFAULT_SYSTEM_PROMPT)
        .map_err(|e| format!("Failed to write system prompt: {e}"))?;

    Ok(prompt_path)
}
