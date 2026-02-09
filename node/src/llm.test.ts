import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { EventEmitter } from 'events'
import type { Config } from './config.js'
import type { ModelAlias } from './config.js'
import { getExecutorForModel } from './llm.js'

const spawnMock = vi.hoisted(() => vi.fn())
const logCliDebugMock = vi.hoisted(() => vi.fn())

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
      codexReasoningEffort: undefined,
      systemPromptPath: undefined,
    }) as Config,
)

vi.mock('./config.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./config.js')>()
  return {
    ...actual,
    config: mockConfig,
    // Re-export these so they remain available
    MODEL_ALIASES: actual.MODEL_ALIASES,
    DEFAULT_ALIAS: actual.DEFAULT_ALIAS,
  }
})
vi.mock('./logger.js', () => ({ logCliDebug: logCliDebugMock }))
vi.mock('child_process', () => ({ spawn: spawnMock }))

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

const setupSpawn = (child: FakeChildProcess) => {
  spawnMock.mockReturnValue(child)
}

beforeEach(() => {
  spawnMock.mockReset()
  logCliDebugMock.mockReset()
  mockConfig.codexReasoningEffort = undefined
})

afterEach(() => {
  vi.useRealTimers()
})

describe('CLI executor', () => {
  it('spawns codex CLI with combined prompt and files', async () => {
    const child = createChildProcess()
    setupSpawn(child)

    const executor = getExecutorForModel('codex')
    const promise = executor.execute('user', 'codex', 'system', [
      '/absolute/path/to/file.ts',
    ])

    resolveCliExecution(child, { stdout: 'result', code: 0 })

    const args = spawnMock.mock.calls[0]
    expect(args?.[0]).toBe('codex')
    const cliArgs = args?.[1] as string[]
    expect(cliArgs[0]).toBe('exec')
    expect(cliArgs[1]).toBe('--skip-git-repo-check')
    expect(cliArgs[2]).toBe('-m')
    expect(cliArgs[3]).toBe('gpt-5.3-codex') // Resolved model name
    expect(cliArgs[4]).toContain('system')
    expect(cliArgs[4]).toContain('user')
    expect(cliArgs[4]).toContain('Files: @')

    const result = await promise
    expect(result.response).toBe('result')
    expect(result.usage).toBeNull()
  })

  it('rejects with codex errors on non-zero exit', async () => {
    const child = createChildProcess()
    setupSpawn(child)

    const executor = getExecutorForModel('codex')
    const promise = executor.execute('user', 'codex', 'system')

    resolveCliExecution(child, { stderr: 'boom', code: 2 })

    await expect(promise).rejects.toThrow(
      'Codex CLI exited with code 2. Error: boom',
    )
  })

  it('includes reasoning effort config when set', async () => {
    mockConfig.codexReasoningEffort = 'xhigh'
    const child = createChildProcess()
    setupSpawn(child)

    const executor = getExecutorForModel('codex')
    const promise = executor.execute('user', 'codex', 'system')

    resolveCliExecution(child, { stdout: 'result', code: 0 })

    const args = spawnMock.mock.calls[0]
    const cliArgs = args?.[1] as string[]
    expect(cliArgs).toContain('-c')
    expect(cliArgs).toContain('model_reasoning_effort="xhigh"')

    await promise
    mockConfig.codexReasoningEffort = undefined // reset for other tests
  })

  it('wraps gemini quota errors specially', async () => {
    const child = createChildProcess()
    setupSpawn(child)

    const executor = getExecutorForModel('gemini')
    const promise = executor.execute('user', 'gemini', 'system')

    resolveCliExecution(child, {
      stderr: 'RESOURCE_EXHAUSTED: quota exceeded',
      code: 1,
    })

    await expect(promise).rejects.toThrow('Gemini quota exceeded')
  })

  it('spawns claude CLI with print mode and model', async () => {
    const child = createChildProcess()
    setupSpawn(child)

    const executor = getExecutorForModel('claude')
    const promise = executor.execute('user', 'claude', 'system')

    resolveCliExecution(child, { stdout: 'result', code: 0 })

    const args = spawnMock.mock.calls[0]
    expect(args?.[0]).toBe('claude')
    const cliArgs = args?.[1] as string[]
    expect(cliArgs[0]).toBe('--print')
    expect(cliArgs[1]).toBe('--model')
    expect(cliArgs[2]).toBe('claude-opus-4-6') // Resolved model name
    expect(cliArgs[3]).toContain('system')
    expect(cliArgs[3]).toContain('user')

    const result = await promise
    expect(result.response).toBe('result')
    expect(result.usage).toBeNull()
  })

  it('spawns kilo CLI with model from config', async () => {
    const child = createChildProcess()
    setupSpawn(child)

    const executor = getExecutorForModel('kilo')
    const promise = executor.execute('user', 'kilo', 'system')

    resolveCliExecution(child, { stdout: 'result', code: 0 })

    const args = spawnMock.mock.calls[0]
    expect(args?.[0]).toBe('kilo')
    const cliArgs = args?.[1] as string[]
    expect(cliArgs[0]).toBe('run')
    expect(cliArgs[1]).toBe('-m')
    expect(cliArgs[2]).toBe('openrouter/moonshotai/kimi-k2.5') // Model from mock config
    expect(cliArgs[3]).toContain('system')

    const result = await promise
    expect(result.response).toBe('result')
    expect(result.usage).toBeNull()
  })

  it('strips ANTHROPIC_API_KEY when spawning claude CLI', async () => {
    const child = createChildProcess()
    setupSpawn(child)

    const previousApiKey = process.env.ANTHROPIC_API_KEY
    process.env.ANTHROPIC_API_KEY = 'test-key'

    try {
      const executor = getExecutorForModel('claude')
      const promise = executor.execute('user', 'claude', 'system')
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
    const child = createChildProcess()
    setupSpawn(child)

    const executor = getExecutorForModel('codex')
    const promise = executor.execute('user', 'codex', 'system')

    child.emit('error', new Error('not found'))

    await expect(promise).rejects.toThrow(
      'Failed to spawn codex CLI. Is it installed and in PATH? Error: not found',
    )
  })

  it('handles synchronous spawn failures', async () => {
    spawnMock.mockImplementation(() => {
      throw new Error('sync failure')
    })

    const executor = getExecutorForModel('codex')
    await expect(executor.execute('user', 'codex', 'system')).rejects.toThrow(
      'Synchronous error while trying to spawn codex: sync failure',
    )
  })
})

describe('executor selection', () => {
  it('returns CLI executor for all 4 aliases', () => {
    // All 4 aliases should work
    expect(() => getExecutorForModel('gemini')).not.toThrow()
    expect(() => getExecutorForModel('claude')).not.toThrow()
    expect(() => getExecutorForModel('codex')).not.toThrow()
    expect(() => getExecutorForModel('kilo')).not.toThrow()
  })

  it('throws on unknown aliases', () => {
    expect(() => getExecutorForModel('unknown' as ModelAlias)).toThrow(
      'Unknown model alias',
    )
  })
})
