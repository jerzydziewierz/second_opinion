import { spawn } from 'child_process'
import { relative } from 'path'
import { config, type ModelAlias } from './config.js'
import { resolveModelAlias } from './schema.js'
import { logCliDebug } from './logger.js'
import { resolveProvider } from './providers.js'

export interface LlmExecutor {
  execute(
    prompt: string,
    alias: ModelAlias,
    systemPrompt: string,
    filePaths?: string[],
  ): Promise<{
    response: string
    usage: null // Usage is always null for CLI mode
  }>
}

/**
 * Configuration for a command-line tool executor.
 */
type CliConfig = {
  cliName: string
  buildArgs: (model: string, fullPrompt: string) => string[]
  handleNonZeroExit: (code: number, stderr: string) => Error
}

function buildCliEnv(alias: ModelAlias): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env }
  const provider = resolveProvider(alias)

  // Ensure CLIs use local subscription auth instead of API key auth
  if (provider === 'claude') {
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
    async execute(prompt, alias, systemPrompt, filePaths) {
      const fullPrompt = buildFullPrompt(prompt, systemPrompt, filePaths)
      // Resolve alias to actual model name
      const model = resolveModelAlias(alias)
      const args = cliConfig.buildArgs(model, fullPrompt)
      const { cliName } = cliConfig
      const env = buildCliEnv(alias)

      return new Promise((resolve, reject) => {
        try {
          logCliDebug(`Spawning ${cliName} CLI`, {
            alias,
            model,
            promptLength: fullPrompt.length,
            filePathsCount: filePaths?.length || 0,
            args: args,
            promptPreview: fullPrompt.slice(0, 300),
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

const kilocodeCliConfig: CliConfig = {
  cliName: 'kilo',
  buildArgs: (model, fullPrompt) => ['run', '-m', model, fullPrompt],
  handleNonZeroExit: (code, stderr) =>
    new Error(`Kilo CLI exited with code ${code}. Error: ${stderr.trim()}`),
}

const createExecutorProvider = () => {
  const executorCache = new Map<ModelAlias, LlmExecutor>()

  return (alias: ModelAlias): LlmExecutor => {
    if (executorCache.has(alias)) {
      return executorCache.get(alias)!
    }

    let executor: LlmExecutor

    switch (alias) {
      case 'gemini':
        executor = createCliExecutor(geminiCliConfig)
        break
      case 'codex':
        executor = createCliExecutor(codexCliConfig)
        break
      case 'claude':
        executor = createCliExecutor(claudeCliConfig)
        break
      case 'kilo':
        executor = createCliExecutor(kilocodeCliConfig)
        break
      default:
        throw new Error(`Unknown model alias: ${alias}`)
    }

    executorCache.set(alias, executor)
    return executor
  }
}

export const getExecutorForModel = createExecutorProvider()
