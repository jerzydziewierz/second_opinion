# Second Opinion MCP — Details

## Configuration

All configuration lives in `~/.config/grey-so/config.json`. See the
[README](README.md) for the full schema and defaults.

There are no environment variables to set. The server reads everything from the
config file and delegates authentication to each CLI tool directly.

## Customization

### System prompt

The system prompt shapes how the consultant LLM responds. To customize it:

```bash
npx grey-so init-prompt
```

This creates `~/.config/grey-so/SYSTEM_PROMPT.md` with the default prompt. Edit
it to suit your needs — changes take effect immediately, no restart required.

You can also point to a different file via `systemPromptPath` in the config:

```json
{
  "systemPromptPath": "./prompts/MY_PROMPT.md"
}
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
the tool when you say "ask gemini", "ask codex", "ask claude", or "ask kilo".

### Querying multiple models

You can ask multiple models in parallel and compare:

```
> /consult ask gemini, codex, and claude about how to fix the race condition
```

The agent will make parallel `consult` calls and summarize where the models
agree or differ.

## Development

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
