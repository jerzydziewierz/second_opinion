# Second Opinion MCP

An MCP server that lets your AI coding assistant consult a different LLM when it
needs a fresh perspective. It delegates to locally installed CLI agent harnesses
— never calls any LLM API directly.

When your agent is stuck or you want a sanity check, just say "ask gemini", "ask
codex", "ask claude", or "ask kilo" and it queries the other model with the
relevant files as context.

## Prerequisites

Install and authenticate the CLI tools you want to use:

1. [Gemini CLI](https://github.com/google-gemini/gemini-cli)
2. [Codex CLI](https://github.com/openai/codex)
3. [Claude Code](https://docs.anthropic.com/en/docs/claude-code/getting-started)
4. [Kilocode CLI](https://github.com/Kilo-Org/kilocode)

Configure each CLI with your preferred billing method (subscription or API key
is handled by the CLI itself — this server never touches API keys).

## Quick start

Register the MCP server:

```bash
claude mcp add --scope user grey-so -- npx -y grey-so
```

Test it:

```
> testing: use the `consult` tool and ask all models - what is the capital of Paris?
```

## How it works

The MCP tool exposes a single `consult` tool. The caller picks one of four
short aliases — `gemini`, `claude`, `codex`, `kilo` — and the server maps that
alias to an actual model name via a config file, then shells out to the
corresponding CLI.

This keeps the MCP interface minimal: the caller never needs to know or pass
real model identifiers.

## Configuration

All settings live in `~/.config/grey-so/config.json`. The file is created
automatically on first run with sensible defaults:

```json
{
  "models": {
    "gemini": "gemini-3-pro-preview",
    "claude": "claude-opus-4-6",
    "codex": "gpt-5.3-codex",
    "kilo": "openrouter/moonshotai/kimi-k2.5"
  },
  "defaultAlias": "gemini"
}
```

| Field                  | Description                                                          |
| ---------------------- | -------------------------------------------------------------------- |
| `models`               | Maps each alias to the actual model name passed to the CLI           |
| `defaultAlias`         | Which alias to use when the caller omits the `model` argument        |
| `codexReasoningEffort` | Optional. One of `none`, `minimal`, `low`, `medium`, `high`, `xhigh` |
| `systemPromptPath`     | Optional. Path to a custom system prompt file                        |

To swap a model, just edit the config — no code changes, no restarts needed.

### System prompt

To customize the system prompt:

```bash
npx grey-so init-prompt
```

This creates `~/.config/grey-so/SYSTEM_PROMPT.md` with the default prompt.
Edit it to suit your needs.

## Example

```
> Still getting this error after your fix. Ask gemini.

  Let me consult Gemini about the Neovim treesitter API changes:

  grey-so:consult (MCP)(prompt: "Neovim plugin broken due to treesitter
                                API changes...", files: ["lua/testonly.lua"],
                                model: "gemini")
   The issue is that iter_matches() can return nil nodes in newer Neovim
    versions. Switch to iter_captures() which never returns nil nodes, and use
    named_child(0) instead of child(0) to get only meaningful syntax nodes.
```

## Further reading

See [DETAILS.md](DETAILS.md) for slash command examples, skill setup, and
development instructions.
