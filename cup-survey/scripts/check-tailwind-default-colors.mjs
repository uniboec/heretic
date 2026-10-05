#!/usr/bin/env node
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(fileURLToPath(import.meta.url), '..', '..')
const RE =
  /\b(?:text|bg|border|ring|fill|stroke|from|to|via|outline|decoration|divide|placeholder|shadow)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d+/g

function walk(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '.next') continue
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) walk(full, files)
    else if (/\.(tsx|ts)$/.test(entry)) files.push(full)
  }
  return files
}

let hits = 0
for (const file of walk(join(ROOT, 'components'))
  .concat(walk(join(ROOT, 'app')))
  .concat(walk(join(ROOT, 'lib')))) {
  const content = readFileSync(file, 'utf8')
  const matches = content.match(RE)
  if (matches?.length) {
    console.error(`${file}: ${matches.join(', ')}`)
    hits += matches.length
  }
}

if (hits > 0) {
  console.error(`Found ${hits} Tailwind default color utility(ies). Use DNA tokens instead.`)
  process.exit(1)
}

console.log('No Tailwind default color utilities found.')
