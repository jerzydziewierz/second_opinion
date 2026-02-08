# grey-rso — Second Opinion MCP (Rust)

A Rust rewrite of the [Second Opinion MCP](../README.md) server. Functionally
equivalent to the TypeScript/Node.js version (`grey-so`), but dramatically
lighter on resources.

## Memory footprint

Measured idle after MCP handshake, both servers loaded side-by-side:

| Server | Runtime | RSS |
|--------|---------|-----|
| `grey-so` (TypeScript) | Node.js v24 | ~70 MB |
| `grey-rso` (Rust, release) | native binary | ~3.3 MB |

**~21x less memory** for the Rust version. The server sits idle most of its
lifetime — it only wakes up when the host agent calls `consult` — so a small
idle footprint matters.

## Quick start

Build the release binary:

```bash
cd rust && cargo build --release
```

Register with Claude Code:

```bash
claude mcp add --scope user grey-rso -- ./rust/target/release/grey-rso
```

The tool interface (`consult`) and config format are identical to `grey-so`.
See the [parent README](../README.md) for usage examples.
