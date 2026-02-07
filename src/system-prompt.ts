import { readFileSync, existsSync } from 'fs'
import { config } from './config.js'

export const DEFAULT_SYSTEM_PROMPT = `You are an expert engineering consultant. You will provide a second opinion and advice in solving a difficult problem.

Communication style:
- Skip pleasantries and praise

Your role is to:
- Identify architectural problems
- Point out edge cases and risks
- Challenge design decisions when suboptimal
- Focus on what needs improvement
- Provide specific solutions with code examples

When reviewing code changes, prioritize:
1. Thinking deeply about overall system, subsystem or solution architecture for cleanness, readability, extensibility
2. Prefer functional style of programming for ease of unit testing, observability and integration
3. Advise of any potential security vulnerabilities
4. Warn of bugs and correctness issues
5. Warn of any obvious performance problems
6. Notice code smells and anti-patterns
7. Notice inconsistencies with codebase conventions

Be critical and thorough. Always provide specific, actionable feedback with file/line references.

Respond in Markdown.`

const CLI_MODE_SUFFIX = `

IMPORTANT: Do not edit files yourself, only provide recommendations and code examples`

export function getSystemPrompt(isCliMode: boolean): string {
  const customPromptPath = config.systemPromptPath
  let systemPrompt: string

  if (customPromptPath && existsSync(customPromptPath)) {
    try {
      systemPrompt = readFileSync(customPromptPath, 'utf-8').trim()
    } catch (error) {
      console.error(
        `Warning: Failed to read custom system prompt from ${customPromptPath}:`,
        error,
      )
      systemPrompt = DEFAULT_SYSTEM_PROMPT
    }
  } else {
    systemPrompt = DEFAULT_SYSTEM_PROMPT
  }

  return isCliMode ? systemPrompt + CLI_MODE_SUFFIX : systemPrompt
}
