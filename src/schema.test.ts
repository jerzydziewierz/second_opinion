import { describe, it, expect } from 'vitest'
import { GetAdviceArgs, SupportedChatModel, ALL_MODELS } from './schema.js'

describe('SupportedChatModel', () => {
  it('accepts known models and rejects unsupported ones', () => {
    expect(SupportedChatModel.safeParse('gemini-3-pro-preview').success).toBe(
      true,
    )
    expect(SupportedChatModel.safeParse('gpt-5.3-codex').success).toBe(true)
    expect(SupportedChatModel.safeParse('claude-opus-4-6').success).toBe(true)
    expect(SupportedChatModel.safeParse('gpt-3.5').success).toBe(false)
  })

  it('ALL_MODELS contains all available models', () => {
    expect(ALL_MODELS).toContain('gemini-3-pro-preview')
    expect(ALL_MODELS).toContain('gpt-5.3-codex')
    expect(ALL_MODELS).toContain('claude-opus-4-6')
    expect(ALL_MODELS).toHaveLength(3)
  })
})

describe('GetAdviceArgs', () => {
  it('requires prompt', () => {
    const result = GetAdviceArgs.safeParse({})
    expect(result.success).toBe(false)
  })

  it('enforces non-empty git diff files', () => {
    const result = GetAdviceArgs.safeParse({
      prompt: 'hey',
      git_diff: { files: [] },
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0]?.message).toContain('At least one file')
    }
  })

  it('applies default base_ref value', () => {
    const result = GetAdviceArgs.safeParse({
      prompt: 'test',
      git_diff: { files: ['a.ts'] },
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.git_diff?.base_ref).toBe('HEAD')
    }
  })

  it('defaults model to a valid enabled model when omitted', () => {
    const parsed = GetAdviceArgs.parse({ prompt: 'hello world' })
    expect(parsed.model).toBe('gemini-3-pro-preview')
  })
})
