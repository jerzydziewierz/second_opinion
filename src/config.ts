import { z } from 'zod/v4'
import { ALL_MODELS, DEFAULT_MODEL } from './models.js'

// Parse allowed models from environment
const rawAllowedModels = process.env.GREY_SO_ALLOWED_MODELS
  ? process.env.GREY_SO_ALLOWED_MODELS.split(',')
      .map((m) => m.trim())
      .filter((m) => m.length > 0)
  : []

const enabledModels =
  rawAllowedModels.length > 0
    ? ALL_MODELS.filter((m) => rawAllowedModels.includes(m))
    : [...ALL_MODELS]

if (enabledModels.length === 0) {
  console.error('❌ Invalid environment variables:')
  console.error('  GREY_SO_ALLOWED_MODELS: No valid models enabled.')
  process.exit(1)
}

// Dynamic Zod enum based on enabled models
export const SupportedChatModel = z.enum(enabledModels as [string, ...string[]])
export type SupportedChatModel = z.infer<typeof SupportedChatModel>

export const fallbackModel = enabledModels[0] ?? DEFAULT_MODEL

const Config = z.object({
  openaiApiKey: z.string().optional(),
  geminiApiKey: z.string().optional(),
  defaultModel: SupportedChatModel.optional(),
  geminiMode: z.enum(['api', 'cli']).default('api'),
  openaiMode: z.enum(['api', 'cli']).default('api'),
  claudeMode: z.enum(['api', 'cli']).default('cli'),
  codexReasoningEffort: z
    .enum(['none', 'minimal', 'low', 'medium', 'high', 'xhigh'])
    .optional(),
  systemPromptPath: z.string().optional(),
})

type ParsedConfig = z.infer<typeof Config>

export type Config = ParsedConfig & {
  allowedModels: string[]
}

const parsedConfig = Config.safeParse({
  openaiApiKey: process.env.OPENAI_API_KEY,
  geminiApiKey: process.env.GEMINI_API_KEY,
  defaultModel: process.env.GREY_SO_DEFAULT_MODEL,
  geminiMode: process.env.GEMINI_MODE,
  openaiMode: process.env.OPENAI_MODE,
  claudeMode: process.env.CLAUDE_MODE,
  codexReasoningEffort: process.env.CODEX_REASONING_EFFORT,
  systemPromptPath: process.env.GREY_SO_SYSTEM_PROMPT_PATH,
})

if (!parsedConfig.success) {
  console.error('❌ Invalid environment variables:')
  for (const issue of parsedConfig.error.issues) {
    console.error(`  ${issue.path.join('.')}: ${issue.message}`)
  }
  process.exit(1)
}

export const config: Config = {
  ...parsedConfig.data,
  allowedModels: enabledModels,
}
