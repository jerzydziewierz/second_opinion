import { describe, expect, it, vi, beforeEach } from 'vitest'
import type { Config } from './config.js'
import type { ModelAlias } from './config.js'
import { isCliMode, resolveProvider } from './providers.js'

const mockConfig = vi.hoisted(
  () =>
    ({
      models: {
        gemini: 'gemini-3-pro-preview',
        claude: 'claude-opus-4-6',
        codex: 'gpt-5.3-codex',
        kilo: 'openrouter/moonshotai/kimi-k2.5',
      },
      defaultAlias: 'gemini' as ModelAlias,
    }) as Config,
)

vi.mock('./config.js', () => ({ config: mockConfig }))

beforeEach(() => {
  // Reset mock if needed
})

describe('providers', () => {
  it('resolves provider by alias', () => {
    expect(resolveProvider('codex')).toBe('openai')
    expect(resolveProvider('gemini')).toBe('gemini')
    expect(resolveProvider('claude')).toBe('claude')
    expect(resolveProvider('kilo')).toBe('kilocode')
  })

  it('always returns CLI mode for all providers', () => {
    // All providers now use CLI mode only
    expect(isCliMode()).toBe(true)
  })

  it('throws for unknown aliases', () => {
    expect(() => resolveProvider('unknown' as ModelAlias)).toThrow(
      'Unknown model alias',
    )
  })
})
