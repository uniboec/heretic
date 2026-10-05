#!/usr/bin/env node
/**
 * UI Debt Scoreboard — automated metrics for cup-survey style migration.
 * Run: node scripts/ui-debt-scoreboard.mjs
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(fileURLToPath(import.meta.url), '..', '..')

const DOMAIN_CSS_DIRS = [
  'styles',
  'components/tournament',
  'components/admin/brackets',
]

/** Foundation CSS — not counted as legacy domain debt */
const DOMAIN_CSS_EXCLUDE = new Set(['styles/base.css', 'styles/modals.css'])

const SCAN_EXTENSIONS = new Set(['.css', '.tsx', '.ts'])

const HEX_RE = /#[0-9a-fA-F]{3,8}\b/g
const DS_TOKEN_DEF_RE = /--ds-[a-z0-9-]+/g
const DS_TOKEN_USE_RE = /var\(--ds-[a-z0-9-]+\)/g
const EVENT_VAR_DEF_RE = /--event-[a-z0-9-]+/g
const BRACKET_VAR_DEF_RE = /--bracket-[a-z0-9-]+/g
const IMPORTANT_RE = /!important/g
const TAILWIND_DEFAULT_COLOR_RE =
  /\b(?:text|bg|border|ring|fill|stroke|from|to|via|outline|decoration|divide|placeholder|shadow)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d+/g
const GLOBAL_BUTTON_INPUT_RE =
  /(?:^|[,{}\s])(?:button|input|select|textarea)\s*[,{]|\.[a-z0-9_-]+\s+button\s*\{/gim

function walk(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (entry === 'node_modules' || entry === '.next' || entry === 'dist') continue
    const st = statSync(full)
    if (st.isDirectory()) walk(full, files)
    else if (SCAN_EXTENSIONS.has(entry.slice(entry.lastIndexOf('.')))) files.push(full)
  }
  return files
}

function isDomainCss(file) {
  const rel = relative(ROOT, file).replace(/\\/g, '/')
  if (!rel.endsWith('.css')) return false
  if (rel === 'app/globals.css') return false
  if (DOMAIN_CSS_EXCLUDE.has(rel)) return false
  return DOMAIN_CSS_DIRS.some((d) => rel.startsWith(d))
}

/** Print overrides legitimately use !important; exclude from debt metric */
function stripPrintMediaBlocks(content) {
  const re = /@media\s+print\s*\{/g
  let stripped = ''
  let cursor = 0

  for (const match of content.matchAll(re)) {
    stripped += content.slice(cursor, match.index)
    let depth = 1
    let i = match.index + match[0].length
    while (i < content.length && depth > 0) {
      const ch = content[i]
      if (ch === '{') depth += 1
      else if (ch === '}') depth -= 1
      i += 1
    }
    cursor = i
  }

  stripped += content.slice(cursor)
  return stripped
}

function countMatches(content, re) {
  const flags = re.flags.includes('g') ? re.flags : `${re.flags}g`
  const globalRe = new RegExp(re.source, flags)
  return [...content.matchAll(globalRe)].length
}

function uniqueMatches(content, re) {
  const flags = re.flags.includes('g') ? re.flags : `${re.flags}g`
  const globalRe = new RegExp(re.source, flags)
  return new Set([...content.matchAll(globalRe)].map((m) => m[0]))
}

const allFiles = walk(ROOT)
const domainCssFiles = allFiles.filter(isDomainCss)
const tsxFiles = allFiles.filter((f) => f.endsWith('.tsx') || f.endsWith('.ts'))

let hardcodedHex = 0
let legacyCssLines = 0
let importantCount = 0
let globalButtonInput = 0

for (const file of domainCssFiles) {
  const content = readFileSync(file, 'utf8')
  const withoutPrint = stripPrintMediaBlocks(content)
  hardcodedHex += countMatches(withoutPrint, HEX_RE)
  legacyCssLines += content.split('\n').length
  importantCount += countMatches(withoutPrint, IMPORTANT_RE)
  globalButtonInput += countMatches(content, GLOBAL_BUTTON_INPUT_RE)
}

const globalsContent = readFileSync(join(ROOT, 'app/globals.css'), 'utf8')
const dsTokenDefs = uniqueMatches(globalsContent, DS_TOKEN_DEF_RE)

let dsTokenUses = 0
let eventVarDefs = new Set()
let bracketVarDefs = new Set()
let tailwindDefaultColors = 0
let rawButtons = 0
let rawInputs = 0

for (const file of allFiles) {
  const rel = relative(ROOT, file).replace(/\\/g, '/')
  if (rel.startsWith('docs/') || rel.startsWith('scripts/ui-debt')) continue
  const content = readFileSync(file, 'utf8')
  dsTokenUses += countMatches(content, DS_TOKEN_USE_RE)
  for (const m of content.matchAll(EVENT_VAR_DEF_RE)) eventVarDefs.add(m[0])
  for (const m of content.matchAll(BRACKET_VAR_DEF_RE)) bracketVarDefs.add(m[0])
  if (file.endsWith('.tsx') || file.endsWith('.ts')) {
    if (!rel.startsWith('scripts/')) {
      tailwindDefaultColors += countMatches(content, TAILWIND_DEFAULT_COLOR_RE)
    }
    if (file.endsWith('.tsx') && !rel.includes('components/ui/')) {
      rawButtons += countMatches(content, /<button\b/g)
      rawInputs += countMatches(content, /<input\b/g)
    }
  }
}

const metrics = {
  hardcodedColorsDomainCss: hardcodedHex,
  dsTokenDefinitions: dsTokenDefs.size,
  dsTokenUsages: dsTokenUses,
  eventVarDefinitions: eventVarDefs.size,
  bracketVarDefinitions: bracketVarDefs.size,
  tailwindDefaultColorUtilities: tailwindDefaultColors,
  importantInDomainCss: importantCount,
  globalButtonInputSelectors: globalButtonInput,
  legacyDomainCssLines: legacyCssLines,
  rawButtonOutsideUi: rawButtons,
  rawInputOutsideUi: rawInputs,
}

const goals = {
  hardcodedColorsDomainCss: 0,
  dsTokenDefinitions: 0,
  dsTokenUsages: 0,
  eventVarDefinitions: 0,
  bracketVarDefinitions: 0,
  tailwindDefaultColorUtilities: 0,
  importantInDomainCss: 0,
  globalButtonInputSelectors: 0,
  legacyDomainCssLines: 1500,
  rawButtonOutsideUi: 0,
  rawInputOutsideUi: 0,
}

const labels = {
  hardcodedColorsDomainCss: 'Hardcoded colors в domain CSS',
  dsTokenDefinitions: '--ds-* определений в @theme',
  dsTokenUsages: 'var(--ds-*) использований',
  eventVarDefinitions: 'Legacy --event-* переменных (unique)',
  bracketVarDefinitions: 'Legacy --bracket-* переменных (unique)',
  tailwindDefaultColorUtilities: 'Tailwind default color utilities вне DNA',
  importantInDomainCss: '!important в domain CSS',
  globalButtonInputSelectors: 'Глобальных button/input selectors',
  legacyDomainCssLines: 'Строк legacy domain CSS',
  rawButtonOutsideUi: 'Raw <button> вне components/ui',
  rawInputOutsideUi: 'Raw <input> вне components/ui',
}

console.log('\nUI Debt Scoreboard — cup-survey\n')
console.log('| Метрика | Сейчас | Цель |')
console.log('|---------|--------|------|')
for (const [key, value] of Object.entries(metrics)) {
  const goal = goals[key]
  const goalStr = goal === 1500 ? '<1500' : String(goal)
  console.log(`| ${labels[key]} | ${value} | ${goalStr} |`)
}
console.log('')

const failing = Object.entries(metrics).filter(([key, value]) => {
  const goal = goals[key]
  return goal === 0 ? value > 0 : value > goal
})

if (failing.length === 0) {
  console.log('All metrics at goal.')
} else {
  console.log(`${failing.length} metric(s) above goal.`)
  process.exitCode = 1
}
