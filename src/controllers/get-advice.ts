import { resolve } from 'path'
import { config } from '../config.js'
import { processFiles, validateContextFiles } from '../file.js'
import { generateGitDiff } from '../git.js'
import { queryLlm } from '../llm-query.js'
import {
  logPrompt,
  logResponse,
  logToolCall,
} from '../logger.js'
import { buildPrompt } from '../prompt-builder.js'
import { isCliMode } from '../providers.js'
import { GetAdviceArgs, type SupportedChatModel } from '../schema.js'

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

  const isCliExecutionMode = isCliMode(model)

  let gitDiffOutput: string | undefined
  if (git_diff) {
    const result = generateGitDiff(
      git_diff.repo_path,
      git_diff.files,
      git_diff.base_ref,
    )
    if (!result.ok) {
      throw new Error(`Git diff failed: ${result.error}`)
    }
    gitDiffOutput = result.diff
  }

  let prompt: string
  let filePaths: string[] | undefined

  if (files?.length) {
    validateContextFiles(files)
  }

  if (!isCliExecutionMode) {
    const contextFiles = files ? processFiles(files) : []
    prompt = buildPrompt(userPrompt, contextFiles, gitDiffOutput)
  } else {
    filePaths = files ? files.map((f) => resolve(f)) : undefined
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
