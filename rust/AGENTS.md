# Second Opinion MCP -- Rust Rewrite

## Goal

Rewrite the Second Opinion MCP server in Rust. The primary motivation is **minimal RAM usage** — the current Node.js/Bun implementation drags in an entire JS runtime (~50-150 MB RSS) just to shuttle prompts between an MCP client and a CLI subprocess. A Rust binary should idle at ~2-5 MB.

This is a **from-scratch rewrite**, not a line-by-line port. Preserve the general concept and external interface; redesign the internals to be idiomatic Rust.

---

## What the app does (conceptual summary)

Second Opinion MCP is an MCP server that exposes a **single tool called `consult`**. An AI coding assistant (Claude Code, Gemini, etc.) calls this tool when the user wants a "second opinion" from a different AI.

The flow is:

1. MCP client sends a `consult` tool call over **stdio** (JSON-RPC).
2. The server resolves the model alias (`gemini`, `claude`, `codex`, `kilo`) to a CLI command and model name via a config file.
3. It assembles a prompt from: system prompt + user prompt + optional file references + optional git diff.
4. It **spawns the target CLI** (e.g. `gemini -m gemini-3-pro-preview -p "..."`) and captures stdout.
5. It returns the CLI's stdout as the tool result.

That's it. The server never touches API keys, never makes HTTP requests, never streams tokens. It is a thin MCP-to-CLI bridge.

---

## External interface (must preserve)

### MCP tool: `consult`

Parameters (JSON Schema):

| Field      | Type              | Required | Description |
|------------|-------------------|----------|-------------|
| `prompt`   | `string`          | yes      | The question for the consultant LLM |
| `model`    | `enum`            | no       | One of `"gemini"`, `"claude"`, `"codex"`, `"kilo"`. Defaults to config `defaultAlias` |
| `files`    | `string[]`        | no       | File paths to include as context |
| `git_diff` | `object`          | no       | `{ repo_path?: string, files: string[], base_ref?: string }` |

### CLI entry points

The binary should support these subcommands/flags:

- `grey-rso` (no args) — start MCP server on stdio
- `grey-rso --version` / `-v` — print version
- `grey-rso init-prompt` — create default system prompt file at `~/.config/grey-rso/SYSTEM_PROMPT.md`

### Config file

Location: `~/.config/grey-rso/config.json`

```json
{
  "models": {
    "gemini": "gemini-3-pro-preview",
    "claude": "claude-opus-4-6",
    "codex": "gpt-5.3-codex",
    "kilo": "openrouter/moonshotai/kimi-k2.5"
  },
  "defaultAlias": "gemini",
  "codexReasoningEffort": "medium",
  "systemPromptPath": "~/.config/grey-rso/SYSTEM_PROMPT.md"
}
```

Auto-created with defaults on first run if missing.

---

## Architecture

### Module layout

```
rust/
  Cargo.toml
  src/
    main.rs          -- CLI arg parsing, stdio transport setup
    server.rs        -- MCP ServerHandler impl, tool dispatch
    config.rs        -- Load/create ~/.config/grey-rso/config.json
    models.rs        -- Alias enum, default model mappings
    cli_exec.rs      -- Spawn CLI subprocesses (gemini, codex, claude, kilo)
    prompt.rs        -- Assemble full prompt (system + user + files + diff)
    git_diff.rs      -- Run `git diff` via Command
    file_check.rs    -- Validate context files (size, binary, sensitive paths)
    system_prompt.rs -- Load/create system prompt
    logger.rs        -- Append-only log to ~/.local/state/grey-rso/mcp.log
```

### Key design decisions

1. **Single binary, no plugins.** `cargo build --release` produces one executable.
2. **Async only where needed.** The `rmcp` crate requires tokio, so we use `tokio::process::Command` for non-blocking CLI spawning. Everything else is synchronous.
3. **No serde_yaml, no toml.** Config is JSON only, matching the existing format.
4. **File content is NOT read into the prompt by the server.** The current TypeScript app passes `@relative/path` references to CLIs and lets them read files. The Rust version should do the same — just pass file paths. This keeps memory usage minimal and avoids duplicating large files in memory.
5. **Structured errors.** Use `thiserror` for error types, map to MCP error responses.

---

## Crate dependencies

### Cargo.toml

```toml
[package]
name = "grey-rso"
version = "0.1.0"
edition = "2024"
description = "Second Opinion MCP server — consult a different AI coding assistant"
license = "MIT"

[[bin]]
name = "grey-rso"
path = "src/main.rs"

[dependencies]
rmcp = { version = "0.14", features = ["server", "transport-io", "macros"] }
tokio = { version = "1", features = ["rt", "macros", "process", "io-std"] }
serde = { version = "1", features = ["derive"] }
serde_json = "1"
schemars = "0.8"
dirs = "6"
clap = { version = "4", features = ["derive"] }
thiserror = "2"
```

### Why each crate

| Crate        | Purpose |
|--------------|---------|
| `rmcp`       | Official Rust MCP SDK. Provides `ServerHandler` trait, `#[tool]` macro, stdio transport. Eliminates all MCP protocol boilerplate. |
| `tokio`      | Async runtime required by `rmcp`. Also used for non-blocking subprocess spawning. |
| `serde` + `serde_json` | Deserialize config.json, serialize log entries. |
| `schemars`   | Generate JSON Schema for tool parameters (required by `rmcp` `#[tool]` macro). |
| `dirs`       | Cross-platform `home_dir()`, `config_dir()`, `state_dir()`. Replaces `os.homedir()`. |
| `clap`       | CLI argument parsing. Replaces `process.argv.includes(...)`. |
| `thiserror`  | Derive `Error` impls for structured error handling. |

### Crates explicitly NOT needed

| Not needed     | Why |
|----------------|-----|
| `reqwest`/`hyper` | No HTTP — all communication is stdio (MCP) or subprocess pipes (CLIs). |
| `zod` equivalent | `schemars` + serde validation covers it. |
| `prettier`    | The TS version used prettier to format log entries. Just write plain text. |
| `regex`       | Git ref and path validation can use simple char checks. |
| `git2`/`libgit2` | Overkill. We only need `git diff` — just spawn `git` as a subprocess. |

---

## CLI provider configurations

Each alias maps to a CLI binary and argument pattern:

| Alias    | Binary   | Args pattern |
|----------|----------|-------------|
| `gemini` | `gemini` | `-m {model} -p {prompt}` |
| `codex`  | `codex`  | `exec --skip-git-repo-check -m {model} [-c model_reasoning_effort="{effort}"] {prompt}` |
| `claude` | `claude` | `--print --model {model} {prompt}` |
| `kilo`   | `kilo`   | `run -m {model} {prompt}` |

For `claude`: delete `ANTHROPIC_API_KEY` from the child environment to force subscription auth.

---

## File validation rules

Before passing file paths to CLIs, validate:

1. **Exists** — reject missing files.
2. **Size** — reject files > 200 KB.
3. **Not binary** — check first 8 KB for null bytes.
4. **Not sensitive** — reject paths matching: `.env*`, `.git/`, `.npmrc`, `.netrc`, SSH keys (`id_rsa`, etc.), cert files (`.pem`, `.p12`, `.pfx`, `.key`).

---

## System prompt

Default system prompt (embedded in binary as a `const &str`):

```
You are an expert engineering consultant. You will provide a second opinion and advice in solving a difficult problem.

Communication style:
- Skip pleasantries and praise

Your role is to:
- Identify architectural problems
- Point out edge cases and risks
- Challenge design decisions when suboptimal
- Focus on what needs improvement
- Provide specific solutions with code examples

When reviewing code changes, prioritize:
1. Thinking deeply about overall system, subsystem or solution architecture
2. Prefer functional style of programming for ease of unit testing
3. Advise of any potential security vulnerabilities
4. Warn of bugs and correctness issues
5. Warn of any obvious performance problems
6. Notice code smells and anti-patterns
7. Notice inconsistencies with codebase conventions

Be critical and thorough. Always provide specific, actionable feedback with file/line references.

Respond in Markdown.

IMPORTANT: Do not edit files yourself, only provide recommendations and code examples
```

---

## Logging

Append-only log at `$XDG_STATE_HOME/grey-rso/mcp.log` (default: `~/.local/state/grey-rso/mcp.log`).

Log entries are plain text with ISO 8601 timestamps. No structured JSON, no rotation.

```
[2026-02-08T12:00:00Z] MCP SERVER STARTED - grey-rso v0.1.0
================================================================================
[2026-02-08T12:00:01Z] TOOL CALL: consult
Arguments: { ... }
================================================================================
[2026-02-08T12:00:02Z] PROMPT (model: gemini):
...
================================================================================
[2026-02-08T12:00:15Z] RESPONSE (model: gemini):
...
================================================================================
```

---

## Implementation order

Suggested order of implementation (each step should compile and, where applicable, pass tests):

1. **Scaffold** — `cargo init`, Cargo.toml with all deps, `main.rs` that just prints version.
2. **Config** — `config.rs` + `models.rs`. Load or create `~/.config/grey-rso/config.json`.
3. **System prompt** — `system_prompt.rs`. Load or create the prompt file.
4. **File validation** — `file_check.rs`. Pure functions, easy to unit test.
5. **Git diff** — `git_diff.rs`. Spawn `git diff`, return `Result<String, Error>`.
6. **Prompt assembly** — `prompt.rs`. Combine system prompt + user prompt + file refs + diff.
7. **CLI execution** — `cli_exec.rs`. Spawn CLI processes, capture stdout, handle errors.
8. **MCP server** — `server.rs`. Implement `ServerHandler`, define `consult` tool with `#[tool]` macro.
9. **Main entry** — `main.rs`. Wire together: clap args, config loading, MCP stdio transport.
10. **Logger** — `logger.rs`. Append-only file logging.
11. **Integration test** — Spawn the binary, send MCP `list_tools` over stdin, verify response.

---

## Testing strategy

- **Unit tests** for: config parsing, file validation, git ref validation, prompt assembly.
- **Integration tests**: spawn the compiled binary, pipe MCP JSON-RPC messages to stdin, assert responses on stdout.
- Run with `cargo test`.

---

## Performance targets

| Metric              | Node.js/Bun (current) | Rust (target) |
|---------------------|----------------------|---------------|
| RSS at idle         | 50-150 MB            | 2-5 MB        |
| Startup time        | 200-500 ms           | < 10 ms       |
| Binary size         | N/A (needs runtime)  | ~5-10 MB      |
| Cold start to first tool response | ~1s    | < 50 ms       |

---

## References

- [Official Rust MCP SDK (rmcp)](https://github.com/modelcontextprotocol/rust-sdk)
- [rmcp on crates.io](https://crates.io/crates/rmcp)
- [MCP specification](https://modelcontextprotocol.io/)
- Parent project README: `../README.md`
- Parent project details: `../DETAILS.md`
