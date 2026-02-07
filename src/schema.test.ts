import { describe, it, expect } from 'vitest'
import { ConsultArgs, MODEL_ALIASES, resolveModelAlias } from './schema.js'
import { config } from './config.js'

describe('MODEL_ALIASES', () => {
  it('contains exactly 4 aliases', () => {
    expect(MODEL_ALIASES).toHaveLength(4)
    expect(MODEL_ALIASES).toContain('gemini')
    expect(MODEL_ALIASES).toContain('claude')
    expect(MODEL_ALIASES).toContain('codex')
    expect(MODEL_ALIASES).toContain('kilo')
  })
})

describe('resolveModelAlias', () => {
  it('resolves aliases to actual model names from config', () => {
    expect(resolveModelAlias('gemini')).toBe(config.models.gemini)
    expect(resolveModelAlias('claude')).toBe(config.models.claude)
    expect(resolveModelAlias('codex')).toBe(config.models.codex)
    expect(resolveModelAlias('kilo')).toBe(config.models.kilo)
  })
})

describe('ConsultArgs', () => {
  it('requires prompt', () => {
    const result = ConsultArgs.safeParse({})
    expect(result.success).toBe(false)
  })

  it('accepts valid model aliases', () => {
    expect(
      ConsultArgs.safeParse({ prompt: 'hey', model: 'gemini' }).success,
    ).toBe(true)
    expect(
      ConsultArgs.safeParse({ prompt: 'hey', model: 'claude' }).success,
    ).toBe(true)
    expect(
      ConsultArgs.safeParse({ prompt: 'hey', model: 'codex' }).success,
    ).toBe(true)
    expect(
      ConsultArgs.safeParse({ prompt: 'hey', model: 'kilo' }).success,
    ).toBe(true)
  })

  it('rejects invalid model aliases', () => {
    expect(
      ConsultArgs.safeParse({ prompt: 'hey', model: 'gpt-4' }).success,
    ).toBe(false)
    expect(
      ConsultArgs.safeParse({ prompt: 'hey', model: 'unknown' }).success,
    ).toBe(false)
  })

  it('enforces non-empty git diff files', () => {
    const result = ConsultArgs.safeParse({
      prompt: 'hey',
      git_diff: { files: [] },
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0]?.message).toContain('At least one file')
    }
  })

  it('applies default base_ref value', () => {
    const result = ConsultArgs.safeParse({
      prompt: 'test',
      git_diff: { files: ['a.ts'] },
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.git_diff?.base_ref).toBe('HEAD')
    }
  })

  it('defaults model to config defaultAlias when omitted', () => {
    const parsed = ConsultArgs.parse({ prompt: 'hello world' })
    expect(parsed.model).toBe(config.defaultAlias)
  })
})
