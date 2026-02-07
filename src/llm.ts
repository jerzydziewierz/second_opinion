import OpenAI from 'openai'
import { spawn } from 'child_process'
import { relative } from 'path'
import { config } from './config.js'
import { type SupportedChatModel as SupportedChatModelType } from './schema.js'
import { logCliDebug } from './logger.js'
import { resolveExecutionMode, resolveProvider } from './providers.js'

export interface LlmExecutor {
  execute(
    prompt: string,
    model: SupportedChatModelType,
    systemPrompt: string,
    filePaths?: string[],
  ): Promise<{
    response: string
    usage: OpenAI.CompletionUsage | null
  }>
}

/**
 * Creates an executor that interacts with an OpenAI-compatible API.
 *
 * Don't let it confuse you that client is of type OpenAI. We used OpenAI API
 * client for Gemini also.
 */
function createApiExecutor(client: OpenAI): LlmExecutor {
  return {
    async execute(prompt, model, systemPrompt, filePaths) {
      if (filePaths && filePaths.length > 0) {
        // Explicitly reject unsupported parameters
        console.warn(
          `Warning: File paths were provided but are not supported by the API executor for model ${model}. They will be ignored.`,
        )
      }

      const completion = await client.chat.completions.create({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt },
        ],
      })

      const response = completion.choices[0]?.message?.content
      if (!response) {
        throw new Error('No response from the model via API')
      }

      return { response, usage: completion.usage ?? null }
    },
  }
}

/**
 * Configuration for a command-line tool executor.
 */
type CliConfig = {
  cliName: string
  buildArgs: (model: SupportedChatModelType, fullPrompt: string) => string[]
  handleNonZeroExit: (code: number, stderr: string) => Error
}

function buildCliEnv(model: SupportedChatModelType): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env }
  const provider = resolveProvider(model)

  // Ensure provider CLIs receive API keys if this server was configured with them.
  if (provider === 'gemini' && config.geminiApiKey && !env.GEMINI_API_KEY) {
    env.GEMINI_API_KEY = config.geminiApiKey
  }
  if (provider === 'openai' && config.openaiApiKey && !env.OPENAI_API_KEY) {
    env.OPENAI_API_KEY = config.openaiApiKey
  }
  if (provider === 'claude') {
    // Force Claude CLI to use local subscription auth instead of API key auth.
    delete env.ANTHROPIC_API_KEY
  }

  return env
}

/**
 * Creates an executor that delegates to a command-line tool.
 */
function createCliExecutor(cliConfig: CliConfig): LlmExecutor {
  const buildFullPrompt = (
    prompt: string,
    systemPrompt: string,
    filePaths?: string[],
  ): string => {
    let fullPrompt = `${systemPrompt}\n\n${prompt}`
    if (filePaths && filePaths.length > 0) {
      const fileReferences = filePaths
        .map((path) => `@${relative(process.cwd(), path)}`)
        .join(' ')
      fullPrompt = `${fullPrompt}\n\nFiles: ${fileReferences}`
    }
    return fullPrompt
  }

  return {
    async execute(prompt, model, systemPrompt, filePaths) {
      const fullPrompt = buildFullPrompt(prompt, systemPrompt, filePaths)
      const args = cliConfig.buildArgs(model, fullPrompt)
      const { cliName } = cliConfig
      const env = buildCliEnv(model)

      return new Promise((resolve, reject) => {
        try {
          logCliDebug(`Spawning ${cliName} CLI`, {
            model,
            promptLength: fullPrompt.length,
            filePathsCount: filePaths?.length || 0,
            args: args,
            promptPreview: fullPrompt.slice(0, 300),
            hasGeminiApiKey: Boolean(env.GEMINI_API_KEY),
            hasOpenaiApiKey: Boolean(env.OPENAI_API_KEY),
          })

          const child = spawn(cliName, args, {
            shell: false,
            stdio: ['ignore', 'pipe', 'pipe'],
            env,
          })

          let stdout = ''
          let stderr = ''
          const startTime = Date.now()

          child.on('spawn', () =>
            logCliDebug(`${cliName} CLI process spawned successfully`),
          )

          child.stdout.on('data', (data: Buffer) => (stdout += data.toString()))
          child.stderr.on('data', (data: Buffer) => (stderr += data.toString()))

          child.on('close', (code) => {
            const duration = Date.now() - startTime

            logCliDebug(`${cliName} CLI process closed`, {
              code,
              duration: `${duration}ms`,
              stdoutLength: stdout.length,
              stderrLength: stderr.length,
            })

            if (code === 0) {
              resolve({ response: stdout.trim(), usage: null })
            } else {
              reject(cliConfig.handleNonZeroExit(code ?? -1, stderr))
            }
          })

          child.on('error', (err) => {
            logCliDebug(`Failed to spawn ${cliName} CLI`, {
              error: err.message,
            })
            reject(
              new Error(
                `Failed to spawn ${cliName} CLI. Is it installed and in PATH? Error: ${err.message}`,
              ),
            )
          })
        } catch (err) {
          reject(
            new Error(
              `Synchronous error while trying to spawn ${cliName}: ${
                err instanceof Error ? err.message : String(err)
              }`,
            ),
          )
        }
      })
    },
  }
}

// --- CLI Configurations ---
const geminiCliConfig: CliConfig = {
  cliName: 'gemini',
  buildArgs: (model, fullPrompt) => ['-m', model, '-p', fullPrompt],
  handleNonZeroExit: (code, stderr) => {
    if (stderr.includes('RESOURCE_EXHAUSTED')) {
      return new Error(
        `Gemini quota exceeded. Consider using gemini-2.0-flash model. Error: ${stderr.trim()}`,
      )
    }
    return new Error(
      `Gemini CLI exited with code ${code}. Error: ${stderr.trim()}`,
    )
  },
}

const codexCliConfig: CliConfig = {
  cliName: 'codex',
  buildArgs: (model, fullPrompt) => {
    const args = ['exec', '--skip-git-repo-check', '-m', model]
    if (config.codexReasoningEffort) {
      args.push('-c', `model_reasoning_effort="${config.codexReasoningEffort}"`)
    }
    args.push(fullPrompt)
    return args
  },
  handleNonZeroExit: (code, stderr) =>
    new Error(`Codex CLI exited with code ${code}. Error: ${stderr.trim()}`),
}

const claudeCliConfig: CliConfig = {
  cliName: 'claude',
  buildArgs: (model, fullPrompt) => ['--print', '--model', model, fullPrompt],
  handleNonZeroExit: (code, stderr) =>
    new Error(`Claude CLI exited with code ${code}. Error: ${stderr.trim()}`),
}

const opencodeCliConfig: CliConfig = {
  cliName: 'opencode',
  buildArgs: (_model, fullPrompt) => ['run', '--print', fullPrompt],
  handleNonZeroExit: (code, stderr) =>
    new Error(`Opencode CLI exited with code ${code}. Error: ${stderr.trim()}`),
}

const kilocodeCliConfig: CliConfig = {
  cliName: 'kilocode',
  buildArgs: (_model, fullPrompt) => ['run', '--print', fullPrompt],
  handleNonZeroExit: (code, stderr) =>
    new Error(`Kilocode CLI exited with code ${code}. Error: ${stderr.trim()}`),
}

const createExecutorProvider = () => {
  const executorCache = new Map<string, LlmExecutor>()
  const clientCache = new Map<string, OpenAI>()

  const getOpenAIClient = (): OpenAI => {
    if (clientCache.has('openai')) return clientCache.get('openai')!
    if (!config.openaiApiKey) {
      throw new Error(
        'OPENAI_API_KEY environment variable is required for OpenAI models in API mode',
      )
    }
    const client = new OpenAI({ apiKey: config.openaiApiKey })
    clientCache.set('openai', client)
    return client
  }

  const getGeminiApiClient = (): OpenAI => {
    if (clientCache.has('geminiApi')) return clientCache.get('geminiApi')!
    if (!config.geminiApiKey) {
      throw new Error(
        'GEMINI_API_KEY environment variable is required for Gemini models in API mode',
      )
    }
    const client = new OpenAI({
      apiKey: config.geminiApiKey,
      baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/',
    })
    clientCache.set('geminiApi', client)
    return client
  }

  return (model: SupportedChatModelType): LlmExecutor => {
    const provider = resolveProvider(model)
    const executionMode = resolveExecutionMode(model)
    const cacheKey = `${provider}-${model}-${executionMode}`

    if (executorCache.has(cacheKey)) {
      return executorCache.get(cacheKey)!
    }

    let executor: LlmExecutor

    if (provider === 'openai') {
      executor =
        executionMode === 'cli'
          ? createCliExecutor(codexCliConfig)
          : createApiExecutor(getOpenAIClient())
    } else if (provider === 'gemini') {
      executor =
        executionMode === 'cli'
          ? createCliExecutor(geminiCliConfig)
          : createApiExecutor(getGeminiApiClient())
    } else if (provider === 'claude') {
      if (executionMode === 'cli') {
        executor = createCliExecutor(claudeCliConfig)
      } else {
        throw new Error(
          'Claude API mode is not implemented yet. Use CLAUDE_MODE=cli.',
        )
      }
    } else if (provider === 'opencode') {
      executor = createCliExecutor(opencodeCliConfig)
    } else if (provider === 'kilocode') {
      executor = createCliExecutor(kilocodeCliConfig)
    } else {
      throw new Error(`Unable to determine LLM provider for model: ${model}`)
    }

    executorCache.set(cacheKey, executor)
    return executor
  }
}

export const getExecutorForModel = createExecutorProvider()
