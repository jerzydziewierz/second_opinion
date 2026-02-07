# Second Opinion MCP — Details

## Configuration

### Environment variables

| Variable                     | Required | Description                                                        |
| ---------------------------- | -------- | ------------------------------------------------------------------ |
| `GEMINI_API_KEY`             | For API  | Google AI API key (Gemini models in API mode)                      |
| `OPENAI_API_KEY`             | For API  | OpenAI API key (Codex models in API mode)                          |
| `GEMINI_MODE`                | No       | `api` (default) or `cli`                                           |
| `OPENAI_MODE`                | No       | `api` (default) or `cli`                                           |
| `CODEX_REASONING_EFFORT`     | No       | `none`, `minimal`, `low`, `medium`, `high`, `xhigh`                |
| `GREY_SO_DEFAULT_MODEL`      | No       | Override default model (`gemini-3-pro-preview` or `gpt-5.3-codex`) |
| `GREY_SO_ALLOWED_MODELS`     | No       | Comma-separated subset to advertise in the tool schema             |
| `GREY_SO_SYSTEM_PROMPT_PATH` | No       | Custom path to system prompt file                                  |

If the `model` argument is omitted in `get_advice`, it defaults to
`gemini-3-pro-preview` unless overridden by `GREY_SO_DEFAULT_MODEL` or narrowed
by `GREY_SO_ALLOWED_MODELS`.

### CLI mode

Instead of API calls, the server can shell out to locally installed CLI tools.
This is useful if you already have the CLIs authenticated or want to use free
quota.

**Gemini CLI:**

```bash
claude mcp add grey-so -e GEMINI_MODE=cli -- npx -y grey-so
```

Requires the [Gemini CLI](https://github.com/google-gemini/gemini-cli) installed
and authenticated (`gemini login`).

**Codex CLI:**

```bash
claude mcp add grey-so -e OPENAI_MODE=cli -- npx -y grey-so
```

Requires the Codex CLI installed and authenticated (`codex login`).

## Customization

### System prompt

The system prompt shapes how the consultant LLM responds. To customize it:

```bash
npx grey-so init-prompt
```

This creates `~/.grey-so/SYSTEM_PROMPT.md` with the default prompt. Edit it to
suit your needs — changes take effect immediately, no restart required.

To use a project-specific prompt instead:

```bash
claude mcp add grey-so \
  -e GEMINI_API_KEY=your_key \
  -e GREY_SO_SYSTEM_PROMPT_PATH=./prompts/SYSTEM_PROMPT.md \
  -- npx -y grey-so
```

## Advanced usage

### Slash command

Save [examples/consult.md](examples/consult.md) as
`~/.claude/commands/consult.md`, then invoke with:

```
/consult ask gemini about the race condition in server.ts
```

The slash command instructs the agent to gather relevant files before calling
the tool — more reliable than relying on natural language inference alone.

### Skill

Save [examples/SKILL.md](examples/SKILL.md) as
`~/.claude/skills/grey-so/SKILL.md`. The agent will then automatically trigger
the tool when you say "ask gemini" or "ask codex".

### Querying both models

You can ask both models in parallel and compare:

```
> /consult ask both gemini and codex about how to fix the race condition
```

The agent will make two `get_advice` calls simultaneously and summarize where
the models agree or differ.

## Development

```bash
git clone <repo-url> && cd grey-so
npm install
npm run build
npm link
claude mcp add grey-so -- grey-so
```

For development without rebuilding:

```bash
claude mcp add grey-so -- npm run dev
```

This runs TypeScript source directly with `tsx`. After changes, restart the
agent to pick up the new version. To unlink: `npm unlink -g`.

To catch stale compiled output before publishing or sharing, run:

```bash
npm run check:dist-fresh
```

This fails if any `src/*.ts` file is newer than its corresponding `dist/*.js`
file or if required dist files are missing.
