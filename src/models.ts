// The 4 supported model aliases that callers can use
export const MODEL_ALIASES = ['gemini', 'claude', 'codex', 'kilo'] as const
export type ModelAlias = (typeof MODEL_ALIASES)[number]

// Default model mapping (can be overridden in config)
export const DEFAULT_MODEL_MAPPING: Record<ModelAlias, string> = {
  gemini: 'gemini-3-pro-preview',
  claude: 'claude-opus-4-6',
  codex: 'gpt-5.3-codex',
  kilo: 'openrouter/moonshotai/kimi-k2.5',
}

// Default alias to use when none specified
export const DEFAULT_ALIAS: ModelAlias = 'gemini'
