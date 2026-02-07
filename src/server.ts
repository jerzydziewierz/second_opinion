import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js'
import { config } from './config.js'
import { toolSchema, type SupportedChatModel } from './schema.js'
import { logServerStart, logConfiguration } from './logger.js'
import { DEFAULT_SYSTEM_PROMPT } from './system-prompt.js'
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { homedir } from 'os'
import { isCliMode } from './providers.js'
import { handleGetAdvice } from './controllers/get-advice.js'

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
  return isCliMode(model)
}
export { handleGetAdvice } from './controllers/get-advice.js'

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
