import { getExecutorForModel } from './llm.js'
import { type ModelAlias } from './config.js'
import { getSystemPrompt } from './system-prompt.js'
import { isCliMode } from './providers.js'

export async function queryLlm(
  prompt: string,
  alias: ModelAlias,
  filePaths?: string[],
): Promise<{
  response: string
  costInfo: string
}> {
  const executor = getExecutorForModel(alias)

  // Get system prompt (with CLI suffix)
  const systemPrompt = getSystemPrompt(isCliMode())

  const { response } = await executor.execute(
    prompt,
    alias,
    systemPrompt,
    filePaths,
  )

  if (!response) {
    throw new Error('No response from the model')
  }

  // CLI mode - no usage data available
  const costInfo = 'Cost data not available (using CLI mode)'

  return { response, costInfo }
}
