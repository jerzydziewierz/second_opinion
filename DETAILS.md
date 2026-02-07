# Second Opinion MCP — Details

## Configuration

All settings live in `~/.config/grey-so/config.json`. The file is created
automatically on first run with sensible defaults:

```json
{
  "models": {
    "gemini": "gemini-3-pro-preview",
    "claude": "claude-opus-4-6",
    "codex": "gpt-5.3-codex",
    "kilo": "openrouter/moonshotai/kimi-k2.5"
  },
  "defaultAlias": "gemini"
}
```

| Field                  | Description                                                          |
| ---------------------- | -------------------------------------------------------------------- |
| `models`               | Maps each alias to the actual model name passed to the CLI           |
| `defaultAlias`         | Which alias to use when the caller omits the `model` argument        |
| `codexReasoningEffort` | Optional. One of `none`, `minimal`, `low`, `medium`, `high`, `xhigh` |
| `systemPromptPath`     | Optional. Path to a custom system prompt file                        |

To swap a model, just edit the config — no code changes, no restarts needed.

### System prompt

To customize the system prompt:

```bash
npx grey-so init-prompt
```

This creates `~/.config/grey-so/SYSTEM_PROMPT.md` with the default prompt.
Edit it to suit your needs.




### Querying multiple models

You can ask multiple models in parallel and compare:

```
> /consult ask gemini, codex, and claude about how to fix the race condition
```

The agent will make parallel `consult` calls and summarize where the models
agree or differ.


## Customization

### System prompt

The system prompt shapes how the consultant LLM responds. To customize it:

```bash
npx grey-so init-prompt
```

This creates `~/.config/grey-so/SYSTEM_PROMPT.md` with the default prompt. Edit
it to suit your needs — changes take effect immediately, no restart required.

You can also point to a different file via `systemPromptPath` in the config:

```json
{
  "systemPromptPath": "./prompts/MY_PROMPT.md"
}
```

## Development

after editing the code, run 
```
npm run install-global
```

and then restart your agent of choice.


Important: to allow automated testing with gemini, for example, 
```bash
gemini -p "testing: use the consult tool and ask all models - what is the capital of Paris?"
```
there are two ways: 
(a) add a `--yolo` flag;
(b) by specifically allowing the "consult" tool only:

in file `~/.gemini/policies/allow-consult.toml` add
```toml
[[rule]]
toolName = "consult"
decision = "allow"
priority = 100
```

with the second option, one can ommit the --yolo flag.

