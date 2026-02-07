import { resolve } from 'path'
import { config, type ModelAlias } from '../config.js'
import { validateContextFiles } from '../file.js'
import { generateGitDiff } from '../git.js'
import { queryLlm } from '../llm-query.js'
import { logPrompt, logResponse, logToolCall } from '../logger.js'
import { GetAdviceArgs } from '../schema.js'

export async function handleGetAdvice(args: unknown) {
  const parseResult = GetAdviceArgs.safeParse(args)
  if (!parseResult.success) {
    const errors = parseResult.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join(', ')
    throw new Error(`Invalid request parameters: ${errors}`)
  }

  const { files, prompt: userPrompt, git_diff, model: alias } = parseResult.data

  logToolCall('get_advice', args)

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

  // Always use CLI mode - pass file paths to CLI
  filePaths = files ? files.map((f) => resolve(f)) : undefined
  prompt = gitDiffOutput
    ? `## Git Diff\n\`\`\`diff\n${gitDiffOutput}\n\`\`\`\n\n${userPrompt}`
    : userPrompt

  await logPrompt(alias, prompt)

  const { response, costInfo } = await queryLlm(prompt, alias, filePaths)
  await logResponse(alias, response, costInfo)

  return {
    content: [{ type: 'text', text: response }],
  }
}
