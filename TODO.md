# TODO

## Critical

- [x] Shell injection in `src/git.ts` — `execSync` with string interpolation of
      user input (`baseRef`, `files`). Switch to `execFileSync` with arg array
      and `shell: false`.
- [x] Git option injection — even after fixing shell injection, user-controlled
      args starting with `-` can be interpreted as git flags (e.g.
      `-c core.sshCommand=...`, `--upload-pack`). Validate refs with strict
      regex, reject args starting with `-`, and use `--` separator before file
      paths.

## Medium

- [ ] Architectural coupling — model detection logic (string prefix checks like
      `gemini-`, `gpt-`) scattered across `src/llm.ts`, `src/llm-query.ts`,
      `src/server.ts`. Refactor into a provider interface/registry.
- [ ] Error swallowing — git diff errors in `src/git.ts` returned as strings
      instead of propagated. LLM could misinterpret error messages as diff
      content. Use explicit failure or Result type.
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
