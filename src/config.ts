import { z } from 'zod/v4'
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'
import {
  MODEL_ALIASES,
  DEFAULT_MODEL_MAPPING,
  DEFAULT_ALIAS,
  type ModelAlias,
} from './models.js'

const CONFIG_DIR = join(homedir(), '.config', 'grey-so')
const CONFIG_PATH = join(CONFIG_DIR, 'config.json')

// Hardcoded defaults - used when config file doesn't exist or is broken
const HARDCODED_DEFAULTS = {
  models: { ...DEFAULT_MODEL_MAPPING },
  defaultAlias: DEFAULT_ALIAS,
  systemPromptPath: join(CONFIG_DIR, 'SYSTEM_PROMPT.md'),
}

// Config schema - everything that can be configured
const ConfigSchema = z.object({
  // Model mappings: alias -> actual model name for CLI
  models: z.record(z.string(), z.string()).default(HARDCODED_DEFAULTS.models),

  // Default alias to use when none specified
  defaultAlias: z.enum(MODEL_ALIASES).default(HARDCODED_DEFAULTS.defaultAlias),

  // CLI-specific settings
  codexReasoningEffort: z
    .enum(['none', 'minimal', 'low', 'medium', 'high', 'xhigh'])
    .optional(),

  // System prompt path
  systemPromptPath: z.string().optional(),
})

export type Config = z.infer<typeof ConfigSchema>

function ensureConfigDir(): void {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true })
  }
}

function writeDefaultConfig(): void {
  ensureConfigDir()
  const defaultConfig = {
    models: HARDCODED_DEFAULTS.models,
    defaultAlias: HARDCODED_DEFAULTS.defaultAlias,
  }
  writeFileSync(CONFIG_PATH, JSON.stringify(defaultConfig, null, 2), 'utf-8')
}

function loadConfig(): Config {
  // If config doesn't exist, create default
  if (!existsSync(CONFIG_PATH)) {
    ensureConfigDir()
    writeDefaultConfig()
  }

  // Read and parse config
  let configData: unknown
  try {
    const fileContent = readFileSync(CONFIG_PATH, 'utf-8')
    configData = JSON.parse(fileContent)
  } catch {
    // If config is broken, recreate with defaults
    writeDefaultConfig()
    configData = {
      models: HARDCODED_DEFAULTS.models,
      defaultAlias: HARDCODED_DEFAULTS.defaultAlias,
    }
  }

  // Parse with zod, using hardcoded defaults as fallback
  const parsed = ConfigSchema.safeParse(configData)
  if (!parsed.success) {
    // Config is malformed - recreate with defaults
    writeDefaultConfig()
    return {
      models: HARDCODED_DEFAULTS.models,
      defaultAlias: HARDCODED_DEFAULTS.defaultAlias,
      systemPromptPath: HARDCODED_DEFAULTS.systemPromptPath,
    }
  }

  // Ensure all required aliases exist in models mapping
  const models = { ...HARDCODED_DEFAULTS.models, ...parsed.data.models }
  for (const alias of MODEL_ALIASES) {
    if (!models[alias]) {
      models[alias] = HARDCODED_DEFAULTS.models[alias]
    }
  }

  // Set default system prompt path if not specified
  const config = parsed.data
  config.models = models
  if (!config.systemPromptPath) {
    config.systemPromptPath = HARDCODED_DEFAULTS.systemPromptPath
  }

  return config
}

// Load config once at module initialization
const loadedConfig = loadConfig()

// Export the config object
export const config: Config = loadedConfig

// Export config path for reference
export { CONFIG_DIR, CONFIG_PATH }

// Re-export model types
export { MODEL_ALIASES, DEFAULT_ALIAS }
export type { ModelAlias }
