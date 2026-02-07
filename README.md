# Second Opinion MCP

An MCP server that lets your AI coding assistant consult a different, strong coding assistant, when it needs a fresh perspective. 

It delegates to locally installed CLI agent harnesses, enabling the subagents to use full power of their tooling: search, explore, inspect e.t.c.

When your agent is stuck or you want a sanity check, just say "ask gemini", "ask
codex", "ask claude", or "ask kilo" and it queries the other model with the
relevant files as context.

## Prerequisites

Install the CLI tools you want to use:

1. [Gemini CLI](https://github.com/google-gemini/gemini-cli)
2. [Codex CLI](https://github.com/openai/codex)
3. [Claude Code](https://docs.anthropic.com/en/docs/claude-code/getting-started)
4. [Kilocode CLI](https://github.com/Kilo-Org/kilocode)

Configure each CLI with your preferred billing method. Subscription or API key
is handled by the CLI itself — this server never touches API keys.

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

This keeps the MCP interface minimal and spends as little of your precious tokens as possible, when not used.


## Example use

```
> Still getting this error after your fix. Ask gemini.

  Let me consult Gemini about the Neovim treesitter API changes:

  grey-so:consult (MCP)(prompt: "Neovim plugin broken due to treesitter
                                API changes...", files: ["lua/testonly.lua"],
                                model: "gemini")
   The issue is that (...)
   ```

## Further reading

See [DETAILS.md](DETAILS.md) for slash command examples, skill setup, and
development instructions.
