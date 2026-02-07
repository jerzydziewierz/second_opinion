#!/usr/bin/env node

import { existsSync, statSync } from 'node:fs'
import { readdir } from 'node:fs/promises'
import { join, relative, resolve } from 'node:path'

const root = process.cwd()
const srcRoot = resolve(root, 'src')
const distRoot = resolve(root, 'dist')

async function collectTsFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true })
  const files = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = join(dir, entry.name)
      if (entry.isDirectory()) {
        return collectTsFiles(fullPath)
      }
      if (entry.isFile() && entry.name.endsWith('.ts')) {
        return [fullPath]
      }
      return []
    }),
  )

  return files.flat()
}

function fail(message) {
  console.error(`\n${message}\n`)
  process.exit(1)
}

if (!existsSync(srcRoot)) {
  fail('Expected src directory, but ./src was not found.')
}

if (!existsSync(distRoot)) {
  fail('Build output missing: ./dist not found. Run: npm run build')
}

const srcFiles = await collectTsFiles(srcRoot)
const outdated = []
const missing = []

for (const srcPath of srcFiles) {
  const rel = relative(srcRoot, srcPath)
  const jsRel = rel.replace(/\.ts$/, '.js')
  const distPath = join(distRoot, jsRel)

  if (!existsSync(distPath)) {
    missing.push(jsRel)
    continue
  }

  const srcMtimeMs = statSync(srcPath).mtimeMs
  const distMtimeMs = statSync(distPath).mtimeMs

  if (srcMtimeMs > distMtimeMs) {
    outdated.push(jsRel)
  }
}

if (missing.length > 0 || outdated.length > 0) {
  const lines = ['Stale build detected: dist is not in sync with src.']

  if (missing.length > 0) {
    lines.push(`Missing files in dist (${missing.length}):`)
    lines.push(...missing.slice(0, 10).map((f) => `  - ${f}`))
    if (missing.length > 10) {
      lines.push(`  ... and ${missing.length - 10} more`)
    }
  }

  if (outdated.length > 0) {
    lines.push(`Outdated files in dist (${outdated.length}):`)
    lines.push(...outdated.slice(0, 10).map((f) => `  - ${f}`))
    if (outdated.length > 10) {
      lines.push(`  ... and ${outdated.length - 10} more`)
    }
  }

  lines.push('Run: npm run build')
  fail(lines.join('\n'))
}

console.log('dist is fresh relative to src.')
