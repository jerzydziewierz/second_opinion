#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <gemini|gpt|claude|kilo> [prompt]"
  exit 1
fi

alias_name="$1"
shift || true
prompt="${*:-what is the capital of Paris?}"

case "$alias_name" in
  gemini) model="gemini-3-pro-preview" ;;
  gpt) model="gpt-5.3-codex" ;;
  claude) model="claude-opus-4-6" ;;
  kilo) model="kilocode-default" ;;
  *)
    echo "Unknown model alias: $alias_name"
    echo "Allowed: gemini, gpt, claude, kilo"
    exit 2
    ;;
esac

# Avoid permissions errors when grey-so writes logs.
export XDG_STATE_HOME="/tmp/grey-so-state"
# Force CLI execution paths for all supported providers.
export GEMINI_MODE="cli"
export OPENAI_MODE="cli"
export CLAUDE_MODE="cli"
# Explicitly inherit Gemini key from parent shell when present.
export GEMINI_API_KEY="${GEMINI_API_KEY-}"
# Force Claude CLI to avoid API-key auth path.
export ANTHROPIC_API_KEY=""

python3 - "$model" "$prompt" <<'PY'
import anyio
import json
import os
import sys

from mcp import ClientSession
from mcp.client.stdio import StdioServerParameters, stdio_client

model = sys.argv[1]
prompt = sys.argv[2]

async def main() -> None:
    child_env = dict(os.environ)
    if "GEMINI_API_KEY" in os.environ:
        child_env["GEMINI_API_KEY"] = os.environ["GEMINI_API_KEY"]
    child_env["ANTHROPIC_API_KEY"] = ""

    params = StdioServerParameters(
        command="grey-so",
        args=[],
        env=child_env,
    )
    async with stdio_client(params) as (read, write):
        async with ClientSession(read, write) as session:
            init_result = await session.initialize()
            tool_result = await session.call_tool(
                "consult",
                {
                    "model": model,
                    "prompt": prompt,
                },
            )

    print(
        json.dumps(
            {
                "protocol": init_result.protocolVersion,
                "server": {
                    "name": init_result.serverInfo.name,
                    "version": init_result.serverInfo.version,
                },
                "model": model,
                "prompt": prompt,
                "result": tool_result.model_dump(mode="json"),
            },
            indent=2,
        )
    )

anyio.run(main)
PY
