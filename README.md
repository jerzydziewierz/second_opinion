# Second Opinion MCP

An MCP server that lets your AI coding assistant consult a different LLM when it
needs a fresh perspective. Currently supports Gemini 3 Pro, GPT-5.3 Codex, and
Claude Opus 4.6 (CLI mode), plus Opencode (CLI mode) — one tool, minimal
context overhead.

When your agent is stuck or you want a sanity check, just say "ask gemini", "ask
codex", "ask claude", or "ask opencode" and it queries the other model with the
relevant files as context.

# Prerequisities

It is assumed that you will be using claude-code as the primary driver, although the tool has also been tested for gemini and codex.

It is most recommended that you use the "cli method" as it gives the subagents
capabilities to explore the repo as needed.

1. install Google Gemini CLI: <https://github.com/google-gemini/gemini-cli>
2. install OpenAI Codex CLI: <https://github.com/openai/codex>
3. install Claude Code: <https://docs.anthropic.com/en/docs/claude-code/getting-started>
4. install Opencode CLI

configure them and make sure they can use your preferred billing method (subscription or API); 

note that as of 2026-02, subscription is approx. 20x cheaper than API;

once configured, test by :

"testing: use the `get_advice` tool and ask all models - what is the capital of Paris?"

## Example

```
> Still getting this error after your fix. Ask gemini.

⏺ Let me consult Gemini about the Neovim treesitter API changes:

⏺ grey-so:get_advice (MCP)(prompt: "Neovim plugin broken due to treesitter
                                API changes...", files: ["lua/testonly.lua"],
                                model: "gemini-3-pro-preview")
  ⎿ The issue is that iter_matches() can return nil nodes in newer Neovim
    versions. Switch to iter_captures() which never returns nil nodes, and use
    named_child(0) instead of child(0) to get only meaningful syntax nodes.
    … +93 lines (ctrl+r to expand)

⏺ The LLM identified the issue - iter_matches() API changed. Switching to
  iter_captures() approach now.
```

## Features

- Query Gemini 3 Pro, GPT-5.3 Codex, Claude Opus 4.6, or Opencode with relevant
  files as context
- Default model is `gemini-3-pro-preview` when `model` is omitted
- API mode (`Gemini`/`Codex`) or, preferably, CLI mode (local
  `gemini`/`codex`/`claude`/`opencode` CLI tools)
- Customizable system prompt via `~/.grey-so/SYSTEM_PROMPT.md`
- Single MCP tool (`get_advice`) — minimal context footprint

## Quick start

Install and authenticate both CLIs first, then register the MCP server in CLI
mode:

```bash
claude mcp add --scope user grey-so -e GEMINI_MODE=cli -e OPENAI_MODE=cli -e CLAUDE_MODE=cli -- npx -y grey-so
```

If you prefer API mode for Gemini/Codex, replace the corresponding `_MODE=cli`
flag with an API key (e.g. `-e GEMINI_API_KEY=your_key`). Note that this will
mean that agentic features (e.g. active exploration) will be severely limited.

Claude support is currently CLI-only (`CLAUDE_MODE=cli`). API mode for Claude is
not implemented yet.

Troubleshooting: If you are using API method in any of the sub-agents, always set their respective API key here; e.g `GEMINI_API_KEY` when using Gemini in API mode. otherwise the given subagent might refuse to run. 

## Further reading

See [DETAILS.md](DETAILS.md) for configuration options, CLI mode setup,
activation methods, slash command examples, and development instructions.
