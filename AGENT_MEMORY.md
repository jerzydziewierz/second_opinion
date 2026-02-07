# Agent Memory

## Project: Second Opinion MCP (grey-so)

Forked from `consult-llm-mcp` by raine. This is a TypeScript MCP server that
lets an AI coding assistant query other LLMs for a "second opinion".

### Naming (completed)

| Concept              | Value                     |
| -------------------- | ------------------------- |
| Human-readable name  | Second Opinion MCP        |
| npm package / binary | `grey-so`                 |
| MCP server name      | `grey-so`                 |
| Tool name            | `get_advice`              |
| Env var prefix       | `GREY_SO_*`               |
| Config dir           | `~/.grey-so/`             |
| Log dir              | `~/.local/state/grey-so/` |

### Key files

- `src/models.ts` — defines ALL_MODELS array (model list lives here)
- `src/config.ts` — reads env vars, builds config; defines SupportedChatModel
  enum
- `src/schema.ts` — tool schema + GetAdviceArgs zod object
- `src/server.ts` — MCP server setup, handleGetAdvice handler
- `src/system-prompt.ts` — default system prompt + custom prompt loading
- `src/llm.ts` / `src/llm-query.ts` — LLM execution (API + CLI modes)
- `src/logger.ts` — logging to state dir

### Remaining tasks (from AGENTS.md)

- Remove deepseek-reasoner
- Identify where model list is, shorten it (answer: `src/models.ts`)
- Identify how to edit model prompt (answer: `src/system-prompt.ts` or
  `~/.grey-so/SYSTEM_PROMPT.md`)
- Shorten README.md, move detail to DETAILS.md

### Model cleanup (completed)

Removed deepseek-reasoner and all other models except `gemini-3-pro-preview` and
`gpt-5.3-codex`. Removed deepseek client code from `llm.ts`, deepseek config
from `config.ts`, stale pricing from `llm-cost.ts`. Default model is now
`gemini-3-pro-preview` (first in the list). 41 tests (was 42, -1 deepseek).

### Environment notes

- No pnpm installed; fixed `package.json` check script to use `npm:check:*`
- Node upgraded to v24.13.0 — no engine warnings
