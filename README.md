# Second Opinion MCP

An MCP server that lets your AI coding assistant consult a different LLM when it
needs a fresh perspective. Currently supports Gemini 3 Pro and GPT-5.3 Codex —
two models, one tool, minimal context overhead.

When your agent is stuck or you want a sanity check, just say "ask gemini" or
"ask codex" and it queries the other model with the relevant files as context.

# Prerequisities

It is assumed that you will be using claude-code as the primary driver, although reverse usage is likely possible too;

It is most recommended that you use the "cli method" as it gives the subagents capabilities to explore the repo as needed. 

install Google/gemini from <CLAUDE: find correct link> and OpenAI/codex from <CLAUDE: find correct link>; configure both them and make sure they can use your preferred billing method (subscription or API); note that as of 2026-02, subscription is approx. 20x cheaper than API;

once configured, test by :

"testing: ask both gemini and GPT, what is the capital of Paris?"

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

- Query Gemini 3 Pro or GPT-5.3 Codex with relevant files as context
- API mode (direct API calls) or CLI mode (local `gemini`/`codex` CLI tools)
- Customizable system prompt via `~/.grey-so/SYSTEM_PROMPT.md`
- Single MCP tool (`get_advice`) — minimal context footprint

## Quick start

```bash
claude mcp add grey-so -e GEMINI_API_KEY=your_key -- npx -y grey-so
```

For global availability across projects, add `--scope user`. For OpenAI models,
add `-e OPENAI_API_KEY=your_key`.

## Further reading

See [DETAILS.md](DETAILS.md) for configuration options, CLI mode setup,
activation methods, slash command examples, and development instructions.
