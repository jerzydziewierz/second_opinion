import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js'
import { config } from './config.js'
import { GetAdviceArgs, toolSchema, type SupportedChatModel } from './schema.js'
import { processFiles } from './file.js'
import { generateGitDiff } from './git.js'
import { buildPrompt } from './prompt-builder.js'
import { queryLlm } from './llm-query.js'
import {
  logToolCall,
  logPrompt,
  logResponse,
  logServerStart,
  logConfiguration,
} from './logger.js'
import { DEFAULT_SYSTEM_PROMPT } from './system-prompt.js'
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs'
import { dirname, join, resolve } from 'path'
import { fileURLToPath } from 'url'
import { homedir } from 'os'

const __dirname = dirname(fileURLToPath(import.meta.url))
const packageJson = JSON.parse(
  readFileSync(join(__dirname, '../package.json'), 'utf-8'),
) as { version: string }
const SERVER_VERSION = packageJson.version

const server = new Server(
  {
    name: 'grey_so',
    version: SERVER_VERSION,
  },
  {
    capabilities: {
      tools: {},
    },
  },
)

server.setRequestHandler(ListToolsRequestSchema, () => {
  return {
    tools: [toolSchema],
  }
})

export function isCliExecution(model: SupportedChatModel): boolean {
  if (model.startsWith('gemini-') && config.geminiMode === 'cli') {
    return true
  }
  if (model.startsWith('gpt-') && config.openaiMode === 'cli') {
    return true
  }
  return false
}

export async function handleGetAdvice(args: unknown) {
  const parseResult = GetAdviceArgs.safeParse(args)
  if (!parseResult.success) {
    const errors = parseResult.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join(', ')
    throw new Error(`Invalid request parameters: ${errors}`)
  }

  const {
    files,
    prompt: userPrompt,
    git_diff,
    model: parsedModel,
  } = parseResult.data

  const providedModel =
    typeof args === 'object' &&
    args !== null &&
    Object.prototype.hasOwnProperty.call(
      args as Record<string, unknown>,
      'model',
    )

  const model: SupportedChatModel = providedModel
    ? parsedModel
    : (config.defaultModel ?? parsedModel)

  logToolCall('get_advice', args)

  const isCliMode = isCliExecution(model)

  let prompt: string
  let filePaths: string[] | undefined

  if (!isCliMode) {
    const contextFiles = files ? processFiles(files) : []

    const gitDiffOutput = git_diff
      ? generateGitDiff(git_diff.repo_path, git_diff.files, git_diff.base_ref)
      : undefined

    prompt = buildPrompt(userPrompt, contextFiles, gitDiffOutput)
  } else {
    filePaths = files ? files.map((f) => resolve(f)) : undefined

    const gitDiffOutput = git_diff
      ? generateGitDiff(git_diff.repo_path, git_diff.files, git_diff.base_ref)
      : undefined

    prompt = gitDiffOutput
      ? `## Git Diff\n\`\`\`diff\n${gitDiffOutput}\n\`\`\`\n\n${userPrompt}`
      : userPrompt
  }

  await logPrompt(model, prompt)

  const { response, costInfo } = await queryLlm(prompt, model, filePaths)
  await logResponse(model, response, costInfo)

  return {
    content: [{ type: 'text', text: response }],
  }
}

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name === 'get_advice') {
    try {
      return await handleGetAdvice(request.params.arguments)
    } catch (error) {
      throw new Error(
        `LLM query failed: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
  }

  throw new Error(`Unknown tool: ${request.params.name}`)
})

export function initSystemPrompt(homeDirectory: string = homedir()) {
  const configDir = join(homeDirectory, '.grey-so')
  const promptPath = join(configDir, 'SYSTEM_PROMPT.md')

  if (existsSync(promptPath)) {
    console.error(`System prompt already exists at: ${promptPath}`)
    console.error('Remove it first if you want to reinitialize.')
    process.exit(1)
  }

  if (!existsSync(configDir)) {
    mkdirSync(configDir, { recursive: true })
  }

  writeFileSync(promptPath, DEFAULT_SYSTEM_PROMPT, 'utf-8')
  console.log(`Created system prompt at: ${promptPath}`)
  console.log('You can now edit this file to customize the system prompt.')
  process.exit(0)
}

export async function main() {
  if (process.argv.includes('--version') || process.argv.includes('-v')) {
    console.log(SERVER_VERSION)
    process.exit(0)
  }

  if (process.argv.includes('init-prompt')) {
    initSystemPrompt()
    return
  }

  logServerStart(SERVER_VERSION)
  logConfiguration(config)

  const transport = new StdioServerTransport()
  await server.connect(transport)
}
