import { describe, it, expect, vi, beforeEach } from 'vitest'
import { generateGitDiff } from './git.js'

const execFileSyncMock = vi.hoisted(() => vi.fn())

vi.mock('child_process', () => ({
  execFileSync: execFileSyncMock,
}))

beforeEach(() => {
  execFileSyncMock.mockReset()
})

describe('generateGitDiff', () => {
  it('returns failure when no files are provided', () => {
    const result = generateGitDiff(undefined, [])
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain('No files specified for git diff')
    }
  })

  it('returns success with diff output', () => {
    execFileSyncMock.mockReturnValueOnce('diff output')

    const result = generateGitDiff('/repo', ['a.ts', 'b.ts'], 'main')

    expect(execFileSyncMock).toHaveBeenCalledWith(
      'git',
      ['diff', 'main', '--', 'a.ts', 'b.ts'],
      {
        cwd: '/repo',
        encoding: 'utf-8',
        maxBuffer: 1024 * 1024,
        timeout: 10_000,
        shell: false,
      },
    )
    expect(result).toEqual({ ok: true, diff: 'diff output' })
  })

  it('uses process.cwd() by default when repo path is missing', () => {
    const cwd = process.cwd()
    execFileSyncMock.mockReturnValueOnce('diff output')

    const result = generateGitDiff(undefined, ['c.ts'])

    expect(execFileSyncMock).toHaveBeenCalledWith(
      'git',
      ['diff', 'HEAD', '--', 'c.ts'],
      {
        cwd,
        encoding: 'utf-8',
        maxBuffer: 1024 * 1024,
        timeout: 10_000,
        shell: false,
      },
    )
    expect(result).toEqual({ ok: true, diff: 'diff output' })
  })

  it('returns failure with error message on git errors', () => {
    execFileSyncMock.mockImplementationOnce(() => {
      throw new Error('boom')
    })

    const result = generateGitDiff('/repo', ['a.ts'])
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain('boom')
    }
  })

  it('rejects baseRef starting with a dash (option injection)', () => {
    const result = generateGitDiff('/repo', ['a.ts'], '-c core.sshCommand=evil')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain('Invalid git ref')
    }
    expect(execFileSyncMock).not.toHaveBeenCalled()
  })

  it('rejects file paths starting with a dash (option injection)', () => {
    const result = generateGitDiff('/repo', ['--output=/tmp/pwn', 'a.ts'])
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain('Invalid file path')
    }
    expect(execFileSyncMock).not.toHaveBeenCalled()
  })

  it('rejects shell metacharacters in file paths', () => {
    const result = generateGitDiff('/repo', ['foo; rm -rf /'])
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain('Invalid file path')
    }
    expect(execFileSyncMock).not.toHaveBeenCalled()
  })

  it('rejects shell metacharacters in baseRef', () => {
    const result = generateGitDiff('/repo', ['a.ts'], '$(whoami)')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain('Invalid git ref')
    }
    expect(execFileSyncMock).not.toHaveBeenCalled()
  })
})
