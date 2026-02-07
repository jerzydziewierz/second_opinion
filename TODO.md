# TODO

## Next

- [x] Rename tool from `get_advice` to `consult` (schema.ts + server.ts dispatch)

## Medium

- [ ] `process.cwd()` default for repo path may be unreliable when MCP server runs from
      a different directory. Consider requiring absolute path from agent.
- [ ] Naming inconsistency — project titled "Second Opinion MCP" but install
      paths and config use `grey-so`. Potential config drift and operator
      confusion.
- [ ] No fallback/timeout policy when selected model is unavailable. In particular, Claude Code often takes longer than 60 seconds to return results.
