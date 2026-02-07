import { type ModelAlias } from './config.js'

export type ProviderId = 'openai' | 'gemini' | 'claude' | 'kilocode'

// Map aliases directly to providers
const ALIAS_TO_PROVIDER: Record<ModelAlias, ProviderId> = {
  gemini: 'gemini',
  claude: 'claude',
  codex: 'openai',
  kilo: 'kilocode',
}

export function resolveProvider(alias: ModelAlias): ProviderId {
  const provider = ALIAS_TO_PROVIDER[alias]
  if (!provider) {
    throw new Error(`Unknown model alias: ${alias}`)
  }
  return provider
}

