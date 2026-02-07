# TODO

## Claude Opus 4.6 Integration Plan

- [x] Phase 1 (now): CLI-only Claude support; do not add Anthropic SDK/API
      dependency yet.
- [x] Add Claude Opus 4.6 model entry (`claude-opus-4-6`) to `src/models.ts`.
- [x] Add `CLAUDE_MODE` configuration in `src/config.ts` (default `cli`; `api`
      intentionally unsupported for now).
- [x] Update request schema/help text in `src/schema.ts` so `model` descriptions
      include Claude selection guidance.
- [x] Implement Claude CLI executor path in `src/llm.ts` using
      `claude --print --model <model> <prompt>`.
- [x] Keep Claude API mode explicitly unimplemented with a clear runtime error
      in `src/llm.ts`.
- [x] Update CLI mode detection in `src/llm-query.ts` and `src/server.ts`
      (`isCliExecution`) to include Claude mode.
- [x] Expand tests for Claude model validation and executor selection/CLI
      behavior in `src/schema.test.ts`, `src/llm.test.ts`, and
      `src/server.test.ts`.
- [x] Update user docs (`README.md`, `DETAILS.md`, `examples/SKILL.md`,
      `examples/consult.md`) for "ask claude" and `CLAUDE_MODE`.
- [x] Run full verification (`npm run test:run`) and fix regressions.
- [ ] Phase 2 (later): API mode support with Anthropic SDK or equivalent API
      path, plus `ANTHROPIC_API_KEY`.

## Critical

- [x] all known critical problems fixed. Be on lookout for any new problems.

## Medium

- [ ] Architectural coupling — model detection logic (string prefix checks like
      `gemini-`, `gpt-`) scattered across `src/llm.ts`, `src/llm-query.ts`,
      `src/server.ts`. Refactor into a provider interface/registry.
- [ ] Data exposure boundary — no redaction/exclusion controls for files sent as
      context. Consider filtering sensitive files (.env, credentials, etc.).
- [ ] Dual execution modes (API vs CLI) can produce different behavior, auth
      flows, and observability. Document or unify expectations.
- [ ] No fallback/timeout policy when selected model is unavailable.

## Low

- [ ] God object — `server.ts` mixes CLI argument parsing, MCP setup, and
      request handling. Extract `handleGetAdvice` to a separate controller.
- [ ] `process.cwd()` default for repo path unreliable when MCP server runs from
      a different directory. Consider requiring absolute path from agent.
- [ ] Naming inconsistency — project titled "Second Opinion MCP" but install
      paths and config use `grey-so`. Potential config drift and operator
      confusion.
- [ ] Prompt governance — mutable global system prompt
      (`~/.grey-so/SYSTEM_PROMPT.md`) makes behavior non-reproducible across
      environments.
