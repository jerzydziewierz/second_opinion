import { readFileSync, existsSync, statSync } from 'fs'
import { resolve } from 'path'

export const MAX_CONTEXT_FILE_BYTES = 200_000

const SENSITIVE_PATH_PATTERNS = [
  /(^|\/)\.env(\..*)?$/i,
  /(^|\/)\.git(\/|$)/i,
  /(^|\/)\.npmrc$/i,
  /(^|\/)\.netrc$/i,
  /(^|\/)id_(rsa|dsa|ecdsa|ed25519)$/i,
  /\.(pem|p12|pfx|key)$/i,
]

function isSensitivePath(filePath: string): boolean {
  const normalized = filePath.replace(/\\/g, '/')
  return SENSITIVE_PATH_PATTERNS.some((pattern) => pattern.test(normalized))
}

function isLikelyBinaryContent(content: Buffer): boolean {
  const bytesToCheck = Math.min(content.length, 8_192)
  for (let i = 0; i < bytesToCheck; i++) {
    if (content[i] === 0) {
      return true
    }
  }
  return false
}

export function validateContextFiles(files: string[]) {
  const resolvedFiles = files.map((f) => resolve(f))
  const missingFiles = resolvedFiles.filter((f) => !existsSync(f))
  if (missingFiles.length > 0) {
    throw new Error(`Files not found: ${missingFiles.join(', ')}`)
  }

  for (let i = 0; i < files.length; i++) {
    const originalPath = files[i]
    const resolvedPath = resolvedFiles[i]

    if (isSensitivePath(originalPath) || isSensitivePath(resolvedPath)) {
      throw new Error(`Blocked sensitive file: ${originalPath}`)
    }

    const stats = statSync(resolvedPath)
    if (stats.size > MAX_CONTEXT_FILE_BYTES) {
      throw new Error(
        `File exceeds max context size (${MAX_CONTEXT_FILE_BYTES} bytes): ${originalPath}`,
      )
    }

    const content = readFileSync(resolvedPath)
    if (isLikelyBinaryContent(content)) {
      throw new Error(`Binary file is not allowed in context: ${originalPath}`)
    }
  }
}

export function processFiles(files: string[]) {
  validateContextFiles(files)

  const contextFiles: { path: string; content: string }[] = []
  const resolvedFiles = files.map((f) => resolve(f))

  for (let i = 0; i < files.length; i++) {
    const filePath = resolvedFiles[i]
    const originalPath = files[i]
    const content = readFileSync(filePath, 'utf-8')
    contextFiles.push({ path: originalPath, content })
  }

  return contextFiles
}
