import { z } from 'zod/v4'
import { ALL_MODELS } from './models.js'
import { SupportedChatModel, fallbackModel } from './config.js'

// Re-export for consumers
export { ALL_MODELS, SupportedChatModel }
export type { SupportedChatModel as SupportedChatModelType }

export const GetAdviceArgs = z.object({
  files: z
    .array(z.string())
    .optional()
    .describe(
      'Array of file paths to include as context. All files are added as context with file paths and code blocks.',
    ),
  prompt: z
    .string()
    .describe(
      'Your question or request for the consultant LLM. Ask neutral, open-ended questions without suggesting specific solutions to avoid biasing the analysis.',
    ),
  model: SupportedChatModel.optional()
    .default(fallbackModel)
    .describe(
      'LLM model to use. Use one of "gpt-5.3-codex", "gemini-3-pro-preview", "claude-opus-4-6", or "kilocode-default" as per user preference.',
    ),
  git_diff: z
    .object({
      repo_path: z
        .string()
        .optional()
        .describe(
          'Path to git repository (defaults to current working directory)',
        ),
      files: z
        .array(z.string())
        .min(1, 'At least one file is required for git diff')
        .describe('Specific files to include in diff'),
      base_ref: z
        .string()
        .optional()
        .default('HEAD')
        .describe(
          'Git reference to compare against (e.g., "HEAD", "main", commit hash)',
        ),
    })
    .optional()
    .describe(
      'Generate git diff output to include as context. Shows uncommitted changes by default.',
    ),
})

const getAdviceInputSchema = z.toJSONSchema(GetAdviceArgs, {
  target: 'openapi-3.0',
})

export const toolSchema = {
  name: 'get_advice',
  description: `Ask a second, different AI for help with the problem at hand. it might have an original idea or approach that you did not think about so far. Provide your question in the prompt field and always include relevant code files as context.

Be specific about what you want: architecture advice, code implementation, document review, bug research, or anything else.

IMPORTANT: Ask neutral, open-ended questions. Avoid suggesting specific solutions or alternatives in your prompt as this can bias the analysis. Instead of "Should I use X or Y approach?", ask "What's the best approach for this problem?" Let the consultant LLM provide unbiased recommendations.`,
  inputSchema: getAdviceInputSchema,
} as const
