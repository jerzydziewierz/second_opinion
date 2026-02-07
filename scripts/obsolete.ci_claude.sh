#!/usr/bin/env bash
# Set up Claude Code to run headless with the grey-so MCP server.
#
# Usage:
#   ./scripts/ci_claude.sh                  # one-time setup
#   claude -p --allowedTools mcp__grey-so__consult "your prompt"
#
# Or source it to get the ci_claude wrapper:
#   source ./scripts/ci_claude.sh
#   ci_claude "use the consult tool and ask gemini: what is the capital of Paris?"
#
# Prerequisites:
#   - node >= 18 on PATH
#   - claude CLI installed
#   - ANTHROPIC_API_KEY set
#   - GEMINI_API_KEY and/or OPENAI_API_KEY set (for the models you want to consult)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# ── 1. Install grey-so globally from this repo ──────────────────────────
echo ":: Installing grey-so from ${PROJECT_DIR} ..."
npm --prefix "$PROJECT_DIR" run build
npm install -g "$PROJECT_DIR"

# Verify it landed on PATH
if ! command -v grey-so &>/dev/null; then
  echo "ERROR: grey-so not found on PATH after install" >&2
  exit 1
fi

# ── 2. Register the MCP server in ~/.claude.json ─────────────────────────
CLAUDE_JSON="$HOME/.claude.json"

if [ ! -f "$CLAUDE_JSON" ]; then
  echo '{}' > "$CLAUDE_JSON"
fi

# Use node to merge the mcpServers entry (safe JSON manipulation)
node -e "
  const fs = require('fs');
  const path = '$CLAUDE_JSON';
  const cfg = JSON.parse(fs.readFileSync(path, 'utf8'));
  cfg.mcpServers = cfg.mcpServers || {};
  cfg.mcpServers['grey-so'] = {
    type: 'stdio',
    command: 'grey-so',
    args: [],
    env: { GEMINI_MODE: 'cli', OPENAI_MODE: 'cli' }
  };
  fs.writeFileSync(path, JSON.stringify(cfg, null, 2) + '\n');
"
echo ":: MCP server registered in ${CLAUDE_JSON}"

# ── 3. Accept project trust (skip the interactive dialog) ───────────────
ABS_PROJECT="$(cd "$PROJECT_DIR" && pwd)"
node -e "
  const fs = require('fs');
  const path = '$CLAUDE_JSON';
  const cfg = JSON.parse(fs.readFileSync(path, 'utf8'));
  cfg.projects = cfg.projects || {};
  const key = '$ABS_PROJECT';
  cfg.projects[key] = cfg.projects[key] || {};
  cfg.projects[key].hasTrustDialogAccepted = true;
  cfg.projects[key].allowedTools = cfg.projects[key].allowedTools || [];
  fs.writeFileSync(path, JSON.stringify(cfg, null, 2) + '\n');
"
echo ":: Project trust accepted for ${ABS_PROJECT}"

# ── 4. Wrapper function (available when sourced) ────────────────────────
# In headless -p mode, settings.local.json permissions are NOT consulted.
# Tools must be explicitly allowed via --allowedTools on the CLI.
ci_claude() {
  claude -p --allowedTools mcp__grey-so__consult "$@"
}
export -f ci_claude

echo ":: CI setup complete. Run:"
echo "   claude -p --allowedTools mcp__grey-so__consult 'your prompt'"
echo "   # or, if sourced:  ci_claude 'your prompt'"
