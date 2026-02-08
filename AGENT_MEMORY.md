# Agent Memory

## Project: Second Opinion MCP (grey-so)

Forked from `consult-llm-mcp` by raine. This is a TypeScript MCP server that
lets an AI coding assistant query other LLMs for a "second opinion".

### Naming

| Concept              | Value                          |
| -------------------- | ------------------------------ |
| Human-readable name  | Second Opinion MCP             |
| npm package / binary | `grey-so`                      |
| MCP server name      | `grey-so`                      |
| Tool name            | `consult`                      |
| Config dir           | `~/.config/grey-so/`           |
| Config file          | `~/.config/grey-so/config.json`|
| System prompt        | `~/.config/grey-so/SYSTEM_PROMPT.md` |
| Log dir              | `~/.local/state/grey-so/`      |

### Architecture (current state)

- **CLI-only**: All 4 providers (gemini, claude, codex, kilo) delegate to
  locally installed CLI tools. No API client code exists.
- **No env vars**: All configuration via `config.json`. No `*_MODE`, no API
  keys, no `GREY_SO_*` env vars in application logic.
- **4 aliases only**: Callers pass `gemini`, `claude`, `codex`, or `kilo`.
  The actual model names are resolved from config. Exact match, no startsWith.
- **No fallbacks**: Unknown alias throws. CLI errors propagate directly.
- **No cost tracking**: `llm-cost.ts` deleted entirely.
- **No isCliMode indirection**: `isCliExecution` and `isCliMode` removed.
  `getSystemPrompt()` always appends CLI suffix.

### Key files

- `src/models.ts` — 4 aliases + default model mapping
- `src/config.ts` — loads/validates `~/.config/grey-so/config.json` with Zod
- `src/schema.ts` — tool schema + `ConsultArgs` zod object + `resolveModelAlias()`
- `src/server.ts` — MCP server setup, routes `consult` to controller
- `src/controllers/consult.ts` — request handler
- `src/system-prompt.ts` — default system prompt + custom prompt loading
- `src/llm.ts` — CLI executor factory (spawn gemini/codex/claude/kilo)
- `src/llm-query.ts` — orchestrates executor + system prompt
- `src/providers.ts` — alias-to-provider mapping (used for env sanitization)
- `src/logger.ts` — logging to state dir

### Migration decision — PENDING

Grey is considering moving off Node.js for startup speed + memory. Two options explored:

1. **Bun migration** — TODO.md has a complete plan reviewed by 3 models (self, Gemini, Codex). ~1 day of work. Saves build step, ~200ms startup. Still 30-60MB RSS.
2. **Rust rewrite** — Official `rmcp` crate (v0.8.0) exists at `modelcontextprotocol/rust-sdk`. Tokio-based, stdio transport supported. Core logic is ~200-300 lines: "concatenate strings, spawn CLI, return stdout." Would give ~1ms startup, ~2-5MB RSS. ~1-2 weeks.

Grey's current stance: "economic argument for do nothing is strong." No decision made — but notes that in the age of LLM agents, the cost calculus shifts. A Rust rewrite isn't 1-2 weeks of human effort; it's more like 3x 20-min sessions of prompt writing + review, with overnight agent work in between.
Key insight from discussion: the real bottleneck is the spawned CLIs (seconds to minutes), not the server runtime. The server is mostly idle.

### All AGENTS.md tasks completed

(a)-(g) all done. README.md and DETAILS.md updated to match.
52 tests pass, TypeScript compiles clean.

### Environment notes

- No pnpm installed; `package.json` check script uses `npm:check:*`
- Node v24.13.0
