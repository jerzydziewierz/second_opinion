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
  it('returns an error string when no files are provided', () => {
    const result = generateGitDiff(undefined, [])
    expect(result).toContain('Error generating git diff')
    expect(result).toContain('No files specified for git diff')
  })

  it('executes git diff with args array and shell disabled', () => {
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
    expect(result).toBe('diff output')
  })

  it('uses process.cwd() by default when repo path is missing', () => {
    const cwd = process.cwd()
    execFileSyncMock.mockReturnValueOnce('diff output')

    generateGitDiff(undefined, ['c.ts'])

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
  })

  it('wraps git errors with a helpful prefix', () => {
    execFileSyncMock.mockImplementationOnce(() => {
      throw new Error('boom')
    })

    const result = generateGitDiff('/repo', ['a.ts'])
    expect(result).toContain('Error generating git diff: boom')
  })

  it('rejects baseRef starting with a dash (option injection)', () => {
    const result = generateGitDiff('/repo', ['a.ts'], '-c core.sshCommand=evil')
    expect(result).toContain('Error generating git diff')
    expect(result).toContain('Invalid git ref')
    expect(execFileSyncMock).not.toHaveBeenCalled()
  })

  it('rejects file paths starting with a dash (option injection)', () => {
    const result = generateGitDiff('/repo', ['--output=/tmp/pwn', 'a.ts'])
    expect(result).toContain('Error generating git diff')
    expect(result).toContain('Invalid file path')
    expect(execFileSyncMock).not.toHaveBeenCalled()
  })

  it('rejects shell metacharacters in file paths', () => {
    const result = generateGitDiff('/repo', ['foo; rm -rf /'])
    expect(result).toContain('Error generating git diff')
    expect(result).toContain('Invalid file path')
    expect(execFileSyncMock).not.toHaveBeenCalled()
  })

  it('rejects shell metacharacters in baseRef', () => {
    const result = generateGitDiff('/repo', ['a.ts'], '$(whoami)')
    expect(result).toContain('Error generating git diff')
    expect(result).toContain('Invalid git ref')
    expect(execFileSyncMock).not.toHaveBeenCalled()
  })
})
