import { execFileSync } from 'child_process'

const SAFE_REF = /^[a-zA-Z0-9_./~^{}-]+$/
const UNSAFE_PATH_CHARS = /[;|&$`\\(){}<>!#'"]/

function validateRef(ref: string): void {
  if (ref.startsWith('-') || !SAFE_REF.test(ref)) {
    throw new Error(`Invalid git ref: ${ref}`)
  }
}

function validateFilePath(file: string): void {
  if (file.startsWith('-') || UNSAFE_PATH_CHARS.test(file)) {
    throw new Error(`Invalid file path: ${file}`)
  }
}

export function generateGitDiff(
  repoPath: string | undefined,
  files: string[],
  baseRef: string = 'HEAD',
): string {
  try {
    const repo = repoPath || process.cwd()
    if (files.length === 0) {
      throw new Error('No files specified for git diff')
    }

    validateRef(baseRef)
    files.forEach(validateFilePath)

    return execFileSync('git', ['diff', baseRef, '--', ...files], {
      cwd: repo,
      encoding: 'utf-8',
      maxBuffer: 1024 * 1024,
      timeout: 10_000,
      shell: false,
    })
  } catch (error) {
    return `Error generating git diff: ${error instanceof Error ? error.message : String(error)}`
  }
}
