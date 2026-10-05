#!/usr/bin/env node
/**
 * Reports CSS class selectors not referenced in TS/TSX. Optional --apply removes dead rules.
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(fileURLToPath(import.meta.url), '..', '..')
const APPLY = process.argv.includes('--apply')

const CSS_FILES = [
  'styles/modals.css',
  'components/tournament/brackets/bracket.css',
]

function walk(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '.next') continue
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) walk(full, files)
    else if (/\.(tsx|ts|jsx|js)$/.test(entry)) files.push(full)
  }
  return files
}

const sourceText = walk(ROOT).map((f) => readFileSync(f, 'utf8')).join('\n')

function isReferenced(className) {
  if (sourceText.includes(className)) return true
  const base = className.replace(/^(event|admin|bracket|reg|app-modal)-/, '')
  if (sourceText.includes(base)) return true
  return false
}

function purgeFile(relPath) {
  const full = join(ROOT, relPath)
  const css = readFileSync(full, 'utf8')
  const lines = css.split('\n')
  const out = []
  let i = 0
  let removed = 0

  while (i < lines.length) {
    const line = lines[i]
    const match = line.match(/^\.([a-zA-Z0-9_-]+)/)
    if (!match) {
      out.push(line)
      i++
      continue
    }

    const className = match[1]
    const blockStart = i
    let blockEnd = i
    let depth = 0
    let started = false

    for (let j = i; j < lines.length; j++) {
      const l = lines[j]
      for (const ch of l) {
        if (ch === '{') {
          depth++
          started = true
        }
        if (ch === '}') depth--
      }
      blockEnd = j
      if (started && depth === 0) break
    }

    const block = lines.slice(blockStart, blockEnd + 1).join('\n')
    const selectorLine = lines[blockStart]
    const classes = [...selectorLine.matchAll(/\.([a-zA-Z0-9_-]+)/g)].map((m) => m[1])
    const dead =
      classes.length > 0 &&
      classes.every((c) => !isReferenced(c)) &&
      !selectorLine.includes('@') &&
      !selectorLine.includes(':')

    if (dead && APPLY) {
      removed++
      i = blockEnd + 1
      continue
    }

    if (!dead) {
      for (let k = blockStart; k <= blockEnd; k++) out.push(lines[k])
    } else {
      removed++
    }
    i = blockEnd + 1
  }

  if (APPLY && removed > 0) {
    writeFileSync(full, out.join('\n'))
  }
  return removed
}

let total = 0
for (const file of CSS_FILES) {
  const n = purgeFile(file)
  console.log(`${file}: ${n} dead rule(s)${APPLY ? ' removed' : ' found'}`)
  total += n
}
console.log(`Total: ${total}`)
