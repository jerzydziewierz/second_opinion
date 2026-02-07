# TODO

## Architectural Decoupling (Lean Plan)

Goal: remove scattered provider/model logic and make new subagents (`opencode`,
`kilocode`) a small, local change.

### MVP (do now)

- [x] Create `src/providers.ts` with a typed `ProviderConfig` and
      `resolveProvider(model)`.
- [x] Move provider matching rules into that module (single source of truth;
      no `startsWith(...)` checks outside resolver).
- [x] Replace provider/model detection in:
      `src/llm.ts`, `src/llm-query.ts`, `src/server.ts`.
- [x] Extract `handleGetAdvice` from `src/server.ts` into
      `src/controllers/get-advice.ts`.
- [x] Add a context security gate before prompt/context build
      (sensitive-file denylist, binary skip, size cap).

### Subagent onboarding path

- [x] Add `opencode` as a provider config + invoke function.
- [x] Add `kilocode` as a provider config + invoke function.
- [x] Add smoke tests for `get_advice` path for each provider.

### Deferred (only if/when needed)

- [ ] Timeout/fallback policy and retry strategy.
- [ ] Full CLI/API behavior unification.
- [ ] Compatibility matrix docs.
- [ ] Runtime schema validation for static provider config.
- [ ] Expanded error taxonomy with stable external error codes.

### Definition of done (MVP)

- [ ] Adding a provider/subagent is usually one config entry + one invoke
      implementation.
- [x] No provider/model prefix matching is duplicated across files.
- [x] Existing Gemini/Codex/Claude behavior remains intact after refactor.
- [x] Sensitive files are blocked from context by default.

## Critical

- [x] all known critical problems fixed. Be on lookout for any new problems.

## Medium

- [ ] `process.cwd()` default for repo path unreliable when MCP server runs from
      a different directory. Consider requiring absolute path from agent.
- [ ] Naming inconsistency — project titled "Second Opinion MCP" but install
      paths and config use `grey-so`. Potential config drift and operator
      confusion.
- [ ] Prompt governance — mutable global system prompt
      (`~/.grey-so/SYSTEM_PROMPT.md`) makes behavior non-reproducible across
      environments.

## Low

- [ ] Dual execution modes (API vs CLI) can produce different behavior, auth
      flows, and observability. Document or unify expectations.
- [ ] No fallback/timeout policy when selected model is unavailable.
