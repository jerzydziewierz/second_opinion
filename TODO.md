# TODO

## Architectural Decoupling Plan (Subagent-Ready)

Goal: make agent/provider/model wiring extensible so adding `opencode` and
`kilocode` later is mostly configuration, not cross-file edits.

### Phase 0: Baseline and constraints

- [ ] Inventory current coupling points in `src/llm.ts`, `src/llm-query.ts`,
      and `src/server.ts` (model prefix checks, provider selection, CLI/API
      mode branching).
- [ ] Define non-goals for first refactor (do not change external MCP tool
      contract or existing model defaults yet).
- [ ] Add architecture note (`docs/architecture/subagents.md`) with current
      flow and target flow.

### Phase 1: Provider/agent registry extraction

- [ ] Introduce a typed `ProviderRegistry` that resolves:
      provider id -> capabilities, auth strategy, model normalization rules,
      invoke adapter.
- [ ] Replace scattered string-prefix logic with `resolveProvider(modelOrId)`.
- [ ] Add `AgentRegistry` abstraction for subagents:
      agent id -> prompt template policy, supported providers/models, execution
      mode constraints.
- [ ] Move all provider/agent metadata into one config module
      (`src/registry/providers.ts`, `src/registry/agents.ts`).

### Phase 2: Execution pipeline decoupling

- [ ] Split orchestration into explicit stages:
      request normalize -> agent resolve -> provider resolve -> context build ->
      invoke -> response map.
- [ ] Extract `handleGetAdvice` from `src/server.ts` into
      `src/controllers/get-advice.ts`.
- [ ] Introduce `ExecutionContext` object passed through stages instead of
      global/shared branching.
- [ ] Add timeout/fallback policy hook in pipeline (initially no-op default,
      pluggable later).

### Phase 3: Contract hardening

- [ ] Define TypeScript interfaces for:
      `ProviderAdapter`, `AgentAdapter`, `ModelResolver`, `ContextFilter`.
- [ ] Add schema validation for registry entries (zod or equivalent) at startup.
- [ ] Add error taxonomy with stable codes
      (`PROVIDER_NOT_FOUND`, `MODEL_UNSUPPORTED`, `AUTH_MISSING`, etc.).
- [ ] Keep existing CLI/API behavior but route both through the same pipeline.

### Phase 4: Subagent onboarding path (`opencode`, `kilocode`)

- [ ] Add stub entries for `opencode` and `kilocode` in `AgentRegistry`
      behind feature flags.
- [ ] Define per-agent system prompt and context policy boundaries.
- [ ] Add compatibility matrix:
      subagent x provider x model family x execution mode.
- [ ] Add smoke tests for each agent through the same `get_advice` entrypoint.

### Phase 5: Testing and rollout

- [ ] Add unit tests for resolver and registry behavior (no string-prefix logic
      outside resolver).
- [ ] Add integration tests for equivalent behavior pre/post refactor for
      Gemini/Codex/Claude.
- [ ] Add snapshot/contract tests for MCP `get_advice` response shape.
- [ ] Land in small PRs:
      1) registry extraction, 2) pipeline extraction, 3) adapter migration,
      4) agent onboarding stubs.

### Definition of done

- [ ] Adding a new subagent requires changes in registry/config only (no edits
      to core server orchestration).
- [ ] Adding a new model family requires resolver config change, not ad-hoc
      string matching across files.
- [ ] CLI and API modes produce equivalent provider-selection behavior.
- [ ] `opencode` and `kilocode` can be introduced as config + adapter stubs with
      passing smoke tests.

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
