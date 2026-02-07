import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, readFileSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join, resolve } from 'path'
import type { Config } from './config.js'
import type { SupportedChatModel } from './schema.js'
import { handleGetAdvice, isCliExecution, initSystemPrompt } from './server.js'

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
      openaiMode: 'api',
      geminiMode: 'api',
      claudeMode: 'cli',
      defaultModel: undefined,
    }) as Config,
)

vi.mock('./config.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./config.js')>()
  return {
    ...actual,
    config: mockConfig,
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
  Object.assign(mockConfig, {
    openaiMode: 'api',
    geminiMode: 'api',
    claudeMode: 'cli',
    defaultModel: undefined,
  })
})

describe('isCliExecution', () => {
  it('detects CLI mode for Gemini, OpenAI, and Claude models', () => {
    mockConfig.geminiMode = 'cli'
    expect(isCliExecution('gemini-3-pro-preview')).toBe(true)
    mockConfig.geminiMode = 'api'
    expect(isCliExecution('gemini-3-pro-preview')).toBe(false)

    mockConfig.openaiMode = 'cli'
    expect(isCliExecution('gpt-5.3-codex')).toBe(true)
    expect(isCliExecution('gpt-5.3-codex')).toBe(true)
    mockConfig.openaiMode = 'api'
    expect(isCliExecution('gpt-5.3-codex')).toBe(false)

    mockConfig.claudeMode = 'cli'
    expect(isCliExecution('claude-opus-4-6')).toBe(true)
    mockConfig.claudeMode = 'api'
    expect(isCliExecution('claude-opus-4-6')).toBe(false)

    expect(isCliExecution('opencode-default')).toBe(true)
    expect(isCliExecution('kilocode-default')).toBe(true)
  })
})

describe('handleGetAdvice', () => {
  it('validates input', async () => {
    await expect(handleGetAdvice({})).rejects.toThrow(
      'Invalid request parameters',
    )
  })

  it('inlines files and git diff for API mode', async () => {
    mockConfig.defaultModel = 'gpt-5.3-codex' as SupportedChatModel
    const result = await handleGetAdvice({
      prompt: 'help me',
      files: ['file1.ts'],
      git_diff: { files: ['src/index.ts'] },
    })

    expect(processFilesMock).toHaveBeenCalledWith(['file1.ts'])
    expect(validateContextFilesMock).toHaveBeenCalledWith(['file1.ts'])
    expect(generateGitDiffMock).toHaveBeenCalledWith(
      undefined,
      ['src/index.ts'],
      'HEAD',
    )
    expect(buildPromptMock).toHaveBeenCalledWith(
      'help me',
      expect.any(Array),
      'diff output',
    )
    expect(queryLlmMock).toHaveBeenCalledWith(
      'BUILT PROMPT',
      'gpt-5.3-codex',
      undefined,
    )
    expect(result.content[0]?.text).toBe('ok')
  })

  it('uses explicit model even when config default exists', async () => {
    mockConfig.defaultModel = 'gpt-5.3-codex' as SupportedChatModel
    await handleGetAdvice({ prompt: 'hello', model: 'gpt-5.3-codex' })
    expect(queryLlmMock).toHaveBeenCalledWith(
      'BUILT PROMPT',
      'gpt-5.3-codex',
      undefined,
    )
  })

  it('builds CLI prompts without file contents', async () => {
    mockConfig.openaiMode = 'cli'
    await handleGetAdvice({
      prompt: 'cli prompt',
      model: 'gpt-5.3-codex',
      files: ['./foo.ts'],
      git_diff: { files: ['foo.ts'], base_ref: 'main', repo_path: '/repo' },
    })

    expect(processFilesMock).not.toHaveBeenCalled()
    expect(validateContextFilesMock).toHaveBeenCalledWith(['./foo.ts'])
    expect(buildPromptMock).not.toHaveBeenCalled()
    const [prompt, model, filePaths] = queryLlmMock.mock.calls[0] as [
      string,
      SupportedChatModel,
      string[] | undefined,
    ]
    expect(prompt).toMatchInlineSnapshot(`
      "## Git Diff
      \`\`\`diff
      diff output
      \`\`\`

      cli prompt"
    `)
    expect(model).toBe('gpt-5.3-codex')
    expect(filePaths).toEqual([resolve('./foo.ts')])
  })

  it('propagates query errors', async () => {
    queryLlmMock.mockRejectedValueOnce(new Error('boom'))
    await expect(handleGetAdvice({ prompt: 'oops' })).rejects.toThrow('boom')
  })

  it('smoke: routes opencode model through get_advice', async () => {
    await handleGetAdvice({
      prompt: 'hello',
      model: 'opencode-default',
      files: ['./foo.ts'],
    })
    expect(queryLlmMock).toHaveBeenCalledWith(
      'hello',
      'opencode-default',
      [resolve('./foo.ts')],
    )
  })

  it('smoke: routes kilocode model through get_advice', async () => {
    await handleGetAdvice({
      prompt: 'hello',
      model: 'kilocode-default',
      files: ['./foo.ts'],
    })
    expect(queryLlmMock).toHaveBeenCalledWith(
      'hello',
      'kilocode-default',
      [resolve('./foo.ts')],
    )
  })
})

describe('initSystemPrompt', () => {
  let tempHome: string

  beforeEach(() => {
    tempHome = mkdtempSync(join(tmpdir(), 'grey-so-home-'))
  })

  afterEach(() => {
    rmSync(tempHome, { recursive: true, force: true })
  })

  const stubExit = () =>
    vi.spyOn(process, 'exit').mockImplementation(() => undefined as never)

  it('creates a default system prompt file', () => {
    const exitSpy = stubExit()
    initSystemPrompt(tempHome)
    const promptPath = join(tempHome, '.grey-so', 'SYSTEM_PROMPT.md')
    const contents = readFileSync(promptPath, 'utf-8')
    expect(contents).toBe('# default prompt')
    expect(exitSpy).toHaveBeenCalledWith(0)
    exitSpy.mockRestore()
  })

  it('rejects reinitialization when file exists', () => {
    const exitSpy = stubExit()
    initSystemPrompt(tempHome)
    exitSpy.mockClear()

    initSystemPrompt(tempHome)
    expect(exitSpy).toHaveBeenCalledWith(1)
    exitSpy.mockRestore()
  })
})
