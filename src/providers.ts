import { config } from './config.js'
import { type SupportedChatModel as SupportedChatModelType } from './schema.js'

export type ProviderId = 'openai' | 'gemini' | 'claude' | 'kilocode'
export type ExecutionMode = 'api' | 'cli'

type ProviderConfig = {
  id: ProviderId
  matchesModel: (model: string) => boolean
  modeFromConfig: () => ExecutionMode
}

const PROVIDERS: ProviderConfig[] = [
  {
    id: 'openai',
    matchesModel: (model) => model.startsWith('gpt-'),
    modeFromConfig: () => config.openaiMode,
  },
  {
    id: 'gemini',
    matchesModel: (model) => model.startsWith('gemini-'),
    modeFromConfig: () => config.geminiMode,
  },
  {
    id: 'claude',
    matchesModel: (model) => model.startsWith('claude-'),
    modeFromConfig: () => config.claudeMode,
  },
  {
    id: 'kilocode',
    matchesModel: (model) => model.startsWith('kilocode-'),
    modeFromConfig: () => 'cli',
  },
]

function getProviderConfig(model: SupportedChatModelType): ProviderConfig {
  const provider = PROVIDERS.find((p) => p.matchesModel(model))
  if (!provider) {
    throw new Error(`Unable to determine LLM provider for model: ${model}`)
  }
  return provider
}

export function resolveProvider(model: SupportedChatModelType): ProviderId {
  return getProviderConfig(model).id
}

export function resolveExecutionMode(
  model: SupportedChatModelType,
): ExecutionMode {
  return getProviderConfig(model).modeFromConfig()
}

export function isCliMode(model: SupportedChatModelType): boolean {
  return resolveExecutionMode(model) === 'cli'
}
