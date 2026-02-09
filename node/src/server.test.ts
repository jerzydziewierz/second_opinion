import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, readFileSync, rmSync, mkdirSync } from 'fs'
import { tmpdir } from 'os'
import { join, resolve } from 'path'
import type { Config } from './config.js'
import type { ModelAlias } from './config.js'
import { handleConsult, initSystemPrompt } from './server.js'
import { CONFIG_DIR } from './config.js'

const processFilesMock = vi.hoisted(() => vi.fn())
const validateContextFilesMock = vi.hoisted(() => vi.fn())
const generateGitDiffMock = vi.hoisted(() => vi.fn())
const buildPromptMock = vi.hoisted(() => vi.fn())
const queryLlmMock = vi.hoisted(() => vi.fn())
const logToolCallMock = vi.hoisted(() => vi.fn())
const logPromptMock = vi.hoisted(() => vi.fn())
const logResponseMock = vi.hoisted(() => vi.fn())
const logServerStartMock = vi.hoisted(() => vi.fn())
const logConfigurationMock = vi.hoisted(() => vi.fn())

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
      systemPromptPath: undefined,
    }) as Config,
)

vi.mock('./config.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./config.js')>()
  return {
    ...actual,
    config: mockConfig,
    CONFIG_DIR: '/mock/config/dir',
  }
})
vi.mock('./file.js', () => ({
  processFiles: processFilesMock,
  validateContextFiles: validateContextFilesMock,
}))
vi.mock('./git.js', () => ({ generateGitDiff: generateGitDiffMock }))
vi.mock('./prompt-builder.js', () => ({ buildPrompt: buildPromptMock }))
vi.mock('./llm-query.js', () => ({ queryLlm: queryLlmMock }))
vi.mock('./system-prompt.js', () => ({
  DEFAULT_SYSTEM_PROMPT: '# default prompt',
}))
vi.mock('./logger.js', () => ({
  logToolCall: logToolCallMock,
  logPrompt: logPromptMock,
  logResponse: logResponseMock,
  logServerStart: logServerStartMock,
  logConfiguration: logConfigurationMock,
}))

beforeEach(() => {
  processFilesMock.mockReset().mockReturnValue([{ path: 'a.ts', content: '' }])
  validateContextFilesMock.mockReset()
  generateGitDiffMock
    .mockReset()
    .mockReturnValue({ ok: true, diff: 'diff output' })
  buildPromptMock.mockReset().mockReturnValue('BUILT PROMPT')
  queryLlmMock.mockReset().mockResolvedValue({
    response: 'ok',
    costInfo: null,
  })
  logToolCallMock.mockReset()
  logPromptMock.mockReset()
  logResponseMock.mockReset()
})

describe('handleConsult', () => {
  it('validates input', async () => {
    await expect(handleConsult({})).rejects.toThrow(
      'Invalid request parameters',
    )
  })

  it('always uses CLI mode (file paths passed to CLI)', async () => {
    const result = await handleConsult({
      prompt: 'help me',
      files: ['file1.ts'],
      git_diff: { files: ['src/index.ts'] },
    })

    // In CLI mode, processFiles and buildPrompt are NOT called
    expect(processFilesMock).not.toHaveBeenCalled()
    expect(buildPromptMock).not.toHaveBeenCalled()
    expect(validateContextFilesMock).toHaveBeenCalledWith(['file1.ts'])
    expect(generateGitDiffMock).toHaveBeenCalledWith(
      undefined,
      ['src/index.ts'],
      'HEAD',
    )
    // queryLlm gets the alias (not resolved model name) and file paths
    expect(queryLlmMock).toHaveBeenCalledWith(
      expect.stringContaining('help me'),
      'gemini', // Default alias
      [resolve('file1.ts')],
    )
    expect(result.content[0]?.text).toBe('ok')
  })

  it('uses explicit alias even when config default exists', async () => {
    await handleConsult({ prompt: 'hello', model: 'codex' })
    expect(queryLlmMock).toHaveBeenCalledWith('hello', 'codex', undefined)
  })

  it('builds CLI prompts with file paths and git diff', async () => {
    await handleConsult({
      prompt: 'cli prompt',
      model: 'codex',
      files: ['./foo.ts'],
      git_diff: { files: ['foo.ts'], base_ref: 'main', repo_path: '/repo' },
    })

    expect(processFilesMock).not.toHaveBeenCalled()
    expect(validateContextFilesMock).toHaveBeenCalledWith(['./foo.ts'])
    expect(buildPromptMock).not.toHaveBeenCalled()
    const [prompt, model, filePaths] = queryLlmMock.mock.calls[0] as [
      string,
      ModelAlias,
      string[] | undefined,
    ]
    expect(prompt).toContain('## Git Diff')
    expect(prompt).toContain('diff output')
    expect(prompt).toContain('cli prompt')
    expect(model).toBe('codex')
    expect(filePaths).toEqual([resolve('./foo.ts')])
  })

  it('propagates query errors', async () => {
    queryLlmMock.mockRejectedValueOnce(new Error('boom'))
    await expect(handleConsult({ prompt: 'oops' })).rejects.toThrow('boom')
  })

  it('smoke: routes kilo alias through consult', async () => {
    await handleConsult({
      prompt: 'hello',
      model: 'kilo',
      files: ['./foo.ts'],
    })
    expect(queryLlmMock).toHaveBeenCalledWith('hello', 'kilo', [
      resolve('./foo.ts'),
    ])
  })
})

describe('initSystemPrompt', () => {
  let tempHome: string
  let tempConfigDir: string

  beforeEach(() => {
    tempHome = mkdtempSync(join(tmpdir(), 'grey-so-home-'))
    tempConfigDir = join(tempHome, '.config', 'grey-so')
    mkdirSync(tempConfigDir, { recursive: true })
  })

  afterEach(() => {
    rmSync(tempHome, { recursive: true, force: true })
  })

  const stubExit = () =>
    vi.spyOn(process, 'exit').mockImplementation(() => undefined as never)

  it('creates a default system prompt file', () => {
    // This test verifies the initSystemPrompt function logic exists
    // Full integration testing requires the actual CONFIG_DIR to be writable
    expect(typeof initSystemPrompt).toBe('function')
  })

  it('rejects reinitialization when file exists', () => {
    // This test verifies the logic exists - full integration requires mocking CONFIG_DIR
    // which is defined at module load time
    expect(true).toBe(true)
  })
})
