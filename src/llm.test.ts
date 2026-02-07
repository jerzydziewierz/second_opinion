import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { EventEmitter } from 'events'
import type { Config } from './config.js'
import type { SupportedChatModel } from './schema.js'
import { getExecutorForModel } from './llm.js'

const createCompletionMock = vi.hoisted(() => vi.fn())
const spawnMock = vi.hoisted(() => vi.fn())
const logCliDebugMock = vi.hoisted(() => vi.fn())

const mockConfig = vi.hoisted(
  () =>
    ({
      openaiApiKey: 'openai',
      geminiApiKey: 'gemini',
      openaiMode: 'api',
      geminiMode: 'api',
      claudeMode: 'cli',
      defaultModel: undefined,
      codexReasoningEffort: undefined,
    }) as Config,
)

vi.mock('./config.js', () => ({ config: mockConfig }))
vi.mock('./logger.js', () => ({ logCliDebug: logCliDebugMock }))
vi.mock('child_process', () => ({ spawn: spawnMock }))
vi.mock('openai', () => {
  class MockOpenAI {
    chat = {
      completions: {
        create: createCompletionMock,
      },
    }

    constructor(options: { apiKey: string; baseURL?: string }) {
      // store options if needed for assertions in the future
      void options
    }
  }

  return { default: MockOpenAI }
})

type FakeChildProcess = EventEmitter & {
  stdout: EventEmitter
  stderr: EventEmitter
  kill: ReturnType<typeof vi.fn>
}

const createChildProcess = (): FakeChildProcess => {
  const child = new EventEmitter() as FakeChildProcess
  child.stdout = new EventEmitter()
  child.stderr = new EventEmitter()
  child.kill = vi.fn()
  return child
}

const resolveCliExecution = (
  child: FakeChildProcess,
  {
    stdout = '',
    stderr = '',
    code = 0,
  }: { stdout?: string; stderr?: string; code?: number } = {},
) => {
  if (stdout) child.stdout.emit('data', stdout)
  if (stderr) child.stderr.emit('data', stderr)
  child.emit('close', code)
}

beforeEach(() => {
  createCompletionMock.mockReset()
  spawnMock.mockReset()
  logCliDebugMock.mockReset()
  Object.assign(mockConfig, {
    openaiApiKey: 'openai',
    geminiApiKey: 'gemini',
    openaiMode: 'api',
    geminiMode: 'api',
    claudeMode: 'cli',
    defaultModel: undefined,
  })
})

afterEach(() => {
  vi.useRealTimers()
})

describe('API executor', () => {
  it('sends system and user prompts and ignores file paths', async () => {
    const usage = { prompt_tokens: 1, completion_tokens: 2, total_tokens: 3 }
    createCompletionMock.mockResolvedValue({
      choices: [{ message: { content: 'answer' } }],
      usage,
    })
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const executor = getExecutorForModel('gpt-5.3-codex')
    const result = await executor.execute(
      'user prompt',
      'gpt-5.3-codex',
      'system prompt',
      ['/tmp/file.ts'],
    )

    expect(createCompletionMock).toHaveBeenCalledWith({
      model: 'gpt-5.3-codex',
      messages: [
        { role: 'system', content: 'system prompt' },
        { role: 'user', content: 'user prompt' },
      ],
    })
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('File paths were provided'),
    )
    expect(result).toEqual({ response: 'answer', usage })
  })

  it('throws when the API returns no content', async () => {
    createCompletionMock.mockResolvedValue({
      choices: [{ message: {} }],
    })

    const executor = getExecutorForModel('gpt-5.3-codex')
    await expect(
      executor.execute('prompt', 'gpt-5.3-codex', 'system'),
    ).rejects.toThrow('No response from the model via API')
  })
})

describe('CLI executor', () => {
  const setupSpawn = (child: FakeChildProcess) => {
    spawnMock.mockReturnValue(child)
  }

  it('spawns codex CLI with combined prompt and files', async () => {
    mockConfig.openaiMode = 'cli'
    const child = createChildProcess()
    setupSpawn(child)

    const executor = getExecutorForModel('gpt-5.3-codex')
    const promise = executor.execute('user', 'gpt-5.3-codex', 'system', [
      '/absolute/path/to/file.ts',
    ])

    resolveCliExecution(child, { stdout: 'result', code: 0 })

    const args = spawnMock.mock.calls[0]
    expect(args?.[0]).toBe('codex')
    const cliArgs = args?.[1] as string[]
    expect(cliArgs[0]).toBe('exec')
    expect(cliArgs[1]).toBe('--skip-git-repo-check')
    expect(cliArgs[2]).toBe('-m')
    expect(cliArgs[3]).toBe('gpt-5.3-codex')
    expect(cliArgs[4]).toContain('system')
    expect(cliArgs[4]).toContain('user')
    expect(cliArgs[4]).toContain('Files: @')

    const result = await promise
    expect(result.response).toBe('result')
    expect(result.usage).toBeNull()
  })

  it('rejects with codex errors on non-zero exit', async () => {
    mockConfig.openaiMode = 'cli'
    const child = createChildProcess()
    setupSpawn(child)

    const executor = getExecutorForModel('gpt-5.3-codex')
    const promise = executor.execute('user', 'gpt-5.3-codex', 'system')

    resolveCliExecution(child, { stderr: 'boom', code: 2 })

    await expect(promise).rejects.toThrow(
      'Codex CLI exited with code 2. Error: boom',
    )
  })

  it('includes reasoning effort config when set', async () => {
    mockConfig.openaiMode = 'cli'
    mockConfig.codexReasoningEffort = 'xhigh'
    const child = createChildProcess()
    setupSpawn(child)

    const executor = getExecutorForModel('gpt-5.3-codex')
    const promise = executor.execute('user', 'gpt-5.3-codex', 'system')

    resolveCliExecution(child, { stdout: 'result', code: 0 })

    const args = spawnMock.mock.calls[0]
    const cliArgs = args?.[1] as string[]
    expect(cliArgs).toContain('-c')
    expect(cliArgs).toContain('model_reasoning_effort="xhigh"')

    await promise
    mockConfig.codexReasoningEffort = undefined // reset for other tests
  })

  it('wraps gemini quota errors specially', async () => {
    mockConfig.geminiMode = 'cli'
    const child = createChildProcess()
    setupSpawn(child)

    const executor = getExecutorForModel('gemini-3-pro-preview')
    const promise = executor.execute('user', 'gemini-3-pro-preview', 'system')

    resolveCliExecution(child, {
      stderr: 'RESOURCE_EXHAUSTED: quota exceeded',
      code: 1,
    })

    await expect(promise).rejects.toThrow('Gemini quota exceeded')
  })

  it('spawns claude CLI with print mode and model', async () => {
    mockConfig.claudeMode = 'cli'
    const child = createChildProcess()
    setupSpawn(child)

    const executor = getExecutorForModel('claude-opus-4-6')
    const promise = executor.execute('user', 'claude-opus-4-6', 'system')

    resolveCliExecution(child, { stdout: 'result', code: 0 })

    const args = spawnMock.mock.calls[0]
    expect(args?.[0]).toBe('claude')
    const cliArgs = args?.[1] as string[]
    expect(cliArgs[0]).toBe('--print')
    expect(cliArgs[1]).toBe('--model')
    expect(cliArgs[2]).toBe('claude-opus-4-6')
    expect(cliArgs[3]).toContain('system')
    expect(cliArgs[3]).toContain('user')

    const result = await promise
    expect(result.response).toBe('result')
    expect(result.usage).toBeNull()
  })

  it('spawns opencode CLI in print mode', async () => {
    const child = createChildProcess()
    setupSpawn(child)

    const executor = getExecutorForModel('opencode-default')
    const promise = executor.execute('user', 'opencode-default', 'system')

    resolveCliExecution(child, { stdout: 'result', code: 0 })

    const args = spawnMock.mock.calls[0]
    expect(args?.[0]).toBe('opencode')
    expect(args?.[1]).toEqual(['run', expect.stringContaining('system')])

    const result = await promise
    expect(result.response).toBe('result')
    expect(result.usage).toBeNull()
  })

  it('spawns kilocode CLI in print mode', async () => {
    const child = createChildProcess()
    setupSpawn(child)

    const executor = getExecutorForModel('kilocode-default')
    const promise = executor.execute('user', 'kilocode-default', 'system')

    resolveCliExecution(child, { stdout: 'result', code: 0 })

    const args = spawnMock.mock.calls[0]
    expect(args?.[0]).toBe('kilocode')
    expect(args?.[1]).toEqual([
      'run',
      '--print',
      expect.stringContaining('system'),
    ])

    const result = await promise
    expect(result.response).toBe('result')
    expect(result.usage).toBeNull()
  })

  it('strips ANTHROPIC_API_KEY when spawning claude CLI', async () => {
    mockConfig.claudeMode = 'cli'
    const child = createChildProcess()
    setupSpawn(child)

    const previousApiKey = process.env.ANTHROPIC_API_KEY
    process.env.ANTHROPIC_API_KEY = 'test-key'

    try {
      const executor = getExecutorForModel('claude-opus-4-6')
      const promise = executor.execute('user', 'claude-opus-4-6', 'system')
      resolveCliExecution(child, { stdout: 'ok', code: 0 })
      await promise

      const spawnOptions = spawnMock.mock.calls[0]?.[2] as
        | { env?: NodeJS.ProcessEnv }
        | undefined
      expect(spawnOptions?.env?.ANTHROPIC_API_KEY).toBeUndefined()
    } finally {
      if (previousApiKey === undefined) {
        delete process.env.ANTHROPIC_API_KEY
      } else {
        process.env.ANTHROPIC_API_KEY = previousApiKey
      }
    }
  })

  it('handles spawn error events with friendly message', async () => {
    mockConfig.openaiMode = 'cli'
    const child = createChildProcess()
    setupSpawn(child)

    const executor = getExecutorForModel('gpt-5.3-codex')
    const promise = executor.execute('user', 'gpt-5.3-codex', 'system')

    child.emit('error', new Error('not found'))

    await expect(promise).rejects.toThrow(
      'Failed to spawn codex CLI. Is it installed and in PATH? Error: not found',
    )
  })

  it('handles synchronous spawn failures', async () => {
    mockConfig.openaiMode = 'cli'
    spawnMock.mockImplementation(() => {
      throw new Error('sync failure')
    })

    const executor = getExecutorForModel('gpt-5.3-codex')
    await expect(
      executor.execute('user', 'gpt-5.3-codex', 'system'),
    ).rejects.toThrow(
      'Synchronous error while trying to spawn codex: sync failure',
    )
  })
})

describe('executor selection', () => {
  it('throws for claude API mode until implemented', () => {
    mockConfig.claudeMode = 'api'
    expect(() => getExecutorForModel('claude-opus-4-6')).toThrow(
      'Claude API mode is not implemented yet. Use CLAUDE_MODE=cli.',
    )
  })

  it('throws on unknown models', () => {
    expect(() =>
      getExecutorForModel('mystery-model' as unknown as SupportedChatModel),
    ).toThrow('Unable to determine LLM provider')
  })
})
