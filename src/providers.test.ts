import { describe, expect, it, vi, beforeEach } from 'vitest'
import type { Config } from './config.js'
import type { SupportedChatModel } from './schema.js'
import {
  isCliMode,
  resolveExecutionMode,
  resolveProvider,
} from './providers.js'

const mockConfig = vi.hoisted(
  () =>
    ({
      openaiMode: 'api',
      geminiMode: 'api',
      claudeMode: 'cli',
    }) as Config,
)

vi.mock('./config.js', () => ({ config: mockConfig }))

beforeEach(() => {
  Object.assign(mockConfig, {
    openaiMode: 'api',
    geminiMode: 'api',
    claudeMode: 'cli',
  })
})

describe('providers', () => {
  it('resolves provider by model prefix', () => {
    expect(resolveProvider('gpt-5.3-codex')).toBe('openai')
    expect(resolveProvider('gemini-3-pro-preview')).toBe('gemini')
    expect(resolveProvider('claude-opus-4-6')).toBe('claude')
    expect(resolveProvider('opencode-default')).toBe('opencode')
    expect(resolveProvider('kilocode-default')).toBe('kilocode')
  })

  it('resolves execution mode from config', () => {
    mockConfig.openaiMode = 'cli'
    mockConfig.geminiMode = 'cli'
    mockConfig.claudeMode = 'api'

    expect(resolveExecutionMode('gpt-5.3-codex')).toBe('cli')
    expect(resolveExecutionMode('gemini-3-pro-preview')).toBe('cli')
    expect(resolveExecutionMode('claude-opus-4-6')).toBe('api')
    expect(resolveExecutionMode('opencode-default')).toBe('cli')
    expect(resolveExecutionMode('kilocode-default')).toBe('cli')
  })

  it('detects cli mode for models', () => {
    mockConfig.openaiMode = 'cli'
    expect(isCliMode('gpt-5.3-codex')).toBe(true)
    mockConfig.openaiMode = 'api'
    expect(isCliMode('gpt-5.3-codex')).toBe(false)
  })

  it('throws for unknown model families', () => {
    expect(() =>
      resolveProvider('mystery-model' as unknown as SupportedChatModel),
    ).toThrow('Unable to determine LLM provider')
  })
})
