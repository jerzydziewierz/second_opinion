# TODO

## Migrate from Node.js to Bun (full cut-over, no npm compat)

### Package manager & deps
- [ ] Delete `package-lock.json`, `node_modules/`
- [ ] Run `bun install` to get `bun.lock`
- [ ] `bun add -d @types/bun`
- [ ] Remove devDeps no longer needed: `tsx`, `vitest`, `concurrently`
- [ ] Remove unused runtime dep: `openai` (not imported anywhere in src/)
- [ ] Verify `zod/v4` subpath export resolves under Bun (`bun src/main.ts --version`)

### Entrypoint & bin
- [ ] Shebang: `#!/usr/bin/env node` → `#!/usr/bin/env bun` in `src/main.ts`
- [ ] `chmod +x src/main.ts`
- [ ] `"main": "dist/main.js"` → `"main": "src/main.ts"`
- [ ] `"bin": { "grey-so": "./dist/main.js" }` → `"bin": { "grey-so": "./src/main.ts" }`

### Drop the build step entirely
- [ ] Delete `dist/`, `tsconfig.tsbuildinfo`
- [ ] `"files"` field: ship `src/` instead of `dist/`

### tsconfig.json
- [ ] Set `"noEmit": true`
- [ ] Set `"moduleResolution": "bundler"`
- [ ] Optionally set `"allowImportingTsExtensions": true`
- [ ] Remove `"composite": true` (only needed for project references / tsc build)

### package.json scripts (all bun, no npm/node)
- [ ] `"build"` → delete (or rename to `"typecheck": "tsc --noEmit"`)
- [ ] `"dev": "tsx src/main.ts"` → `"dev": "bun src/main.ts"`
- [ ] `"start": "node dist/main.js"` → `"start": "bun src/main.ts"`
- [ ] `"test": "vitest"` → `"test": "bun test"`
- [ ] `"test:run": "vitest run"` → `"test:run": "bun test"`
- [ ] `"install-global"` → remove `npm run build` step, use `bun link` or equivalent
- [ ] `"check"` scripts → replace `concurrently "npm:check:*"` with bun equivalents
- [ ] `"check:dist-fresh"` → delete (references missing `scripts/check-dist-fresh.mjs`)
- [ ] `"prepublishOnly"` → update to use bun commands
- [ ] `"publish:*"` → update to use `bun publish` or keep npm publish if targeting npm registry

### package.json metadata
- [ ] `"engines": { "node": ">=18.0.0" }` → `"engines": { "bun": ">=1.0.0" }` or remove

### Tests: vitest → bun test
- [ ] Delete `vitest.config.ts`
- [ ] Change all test imports: `from 'vitest'` → `from 'bun:test'`
- [ ] `vi.mock('child_process', ...)` → `mock.module('child_process', ...)`
- [ ] Rewrite `vi.hoisted` patterns (used in `llm.test.ts`, `server.test.ts`, `git.test.ts`, `providers.test.ts`) — Bun doesn't support `vi.hoisted`. Use `mock.module()` called before a dynamic `await import()` of the module under test
- [ ] `vi.fn()` → `mock()` (optional — Bun exposes vitest-compat `vi` object, so not strictly required)
- [ ] `vi.mocked()` → cast or use `mock` directly
- [ ] Pre-import mock strategy: modules with side effects at import time (e.g. `config.ts` runs `loadConfig()`) need `mock.module()` *before* dynamic import
- [ ] Remove `"types": ["vitest/globals"]` from tsconfig
- [ ] Verify all tests pass with `bun test`

### Smoke test
- [ ] `@modelcontextprotocol/sdk` — do a real stdio handshake under Bun (SDK metadata targets Node, works empirically but not guaranteed)
- [ ] Verify spawned CLIs (`gemini`, `codex`, `claude`, `kilo`) are found in PATH — Bun's global bin location may differ from Node/npm

### No code changes needed
- All Node.js APIs used (`child_process`, `fs`, `path`, `os`, `url`, `process`, `Buffer`) are in Bun's compat layer
- ESM — already `"type": "module"`
- `.js` import extensions — Bun resolves these to `.ts` automatically

---

## Next

- [x] Rename tool from `get_advice` to `consult` (schema.ts + server.ts dispatch)

## Medium

- [ ] `process.cwd()` default for repo path may be unreliable when MCP server runs from
      a different directory. Consider requiring absolute path from agent.
- [ ] Naming inconsistency — project titled "Second Opinion MCP" but install
      paths and config use `grey-so`. Potential config drift and operator
      confusion.
- [ ] No fallback/timeout policy when selected model is unavailable. In particular, Claude Code often takes longer than 60 seconds to return results. (`src/llm.ts:69-134` has no timeout on spawn — hangs indefinitely on provider outage. Highest-priority non-migration item.)
