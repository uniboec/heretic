import { getPublicBouts } from '../lib/bouts/service'
import { getPublicBrackets } from '../lib/brackets/service'
import { loadScheduleDisplayByBoutId } from '../lib/bouts/loadScheduleDisplayByBoutId'
import {
  parseInternalAdvanceHintLabel,
  resolveBronzeFightTitle,
  resolveStaleAdvanceHintLabel,
} from '../lib/brackets/scheduleHint'
import { isStaleInternalBoutLabel } from '../lib/brackets/scheduleBoutLabel'
import { resolveBracketMatchLabel } from '../lib/brackets/scheduleBoutLabel'
import { formatAdvanceHintFromSource } from '../lib/brackets/print/formatAdvanceHint'
import { prisma } from '../lib/prisma'

function categoryHasReleasedBouts(
  categoryKey: string,
  scheduleDisplayByBoutId: Map<string, string>,
): boolean {
  const prefix = `${categoryKey}::`
  for (const boutId of scheduleDisplayByBoutId.keys()) {
    if (boutId.startsWith(prefix)) return true
  }
  return false
}

const INTERNAL_WINNER_HINT = /^Победитель боя (\d+)$/
const INTERNAL_LOSER_HINT = /^Проигравший боя (\d+)$/
const INTERNAL_BRONZE_TITLE = /^Бой за 3-е место \((\d+)\)$/

async function main() {
  const issues: string[] = []

  const boutsData = await getPublicBouts()
  if (!boutsData?.published) {
    console.log(JSON.stringify({ error: 'Public bouts not published' }, null, 2))
    return
  }

  const scheduleDisplayByBoutId = await loadScheduleDisplayByBoutId()

  for (const mat of boutsData.mats) {
    for (const bout of mat.bouts) {
      if ('matchNumber' in bout) {
        issues.push(`[bouts-api] matchNumber leaked: ${bout.id}`)
      }
      if (!bout.scheduleDisplayNumber) {
        issues.push(`[bouts-api] empty scheduleDisplayNumber: ${bout.id}`)
      }
      if (bout.label && isStaleInternalBoutLabel(bout.label)) {
        issues.push(`[bouts-api] stale bout.label: ${bout.id} "${bout.label}"`)
      }
      for (const side of [bout.sideA, bout.sideB]) {
        if (side.kind !== 'hint' || !side.label) continue
        if (INTERNAL_WINNER_HINT.test(side.label) || INTERNAL_LOSER_HINT.test(side.label)) {
          issues.push(`[bouts-api] stale hint: ${bout.id} "${side.label}"`)
        }
      }
    }
  }

  const bracketsData = await getPublicBrackets()
  if (bracketsData?.published) {
    for (const category of bracketsData.categories) {
      if (!category.structure) continue
      const categoryKey = category.categoryKey
      const boutsReleased =
        category.boutsReleased === true ||
        categoryHasReleasedBouts(categoryKey, scheduleDisplayByBoutId)

      for (const match of category.structure.rounds) {
        const uiLabel = resolveBracketMatchLabel({
          categoryKey,
          matchId: match.id,
          label: match.label,
          matchNumber: match.matchNumber,
          slot: match.slot,
          scheduleDisplayByBoutId,
        })
        if (/^Бой \d+$/.test(uiLabel)) {
          issues.push(`[brackets-ui] stale match label ${categoryKey} ${match.id}: "${uiLabel}"`)
        }

        for (const side of ['A', 'B'] as const) {
          const hint = side === 'A' ? match.slotHintA : match.slotHintB
          const source = side === 'A' ? match.slotSourceA : match.slotSourceB
          if (!hint) continue
          const resolved = source
            ? formatAdvanceHintFromSource(category.structure!.rounds, source, {
                categoryKey,
                released: boutsReleased,
                scheduleDisplayByBoutId,
                fallbackHint: hint,
              }) ?? hint
            : resolveStaleAdvanceHintLabel({
                label: hint,
                categoryKey,
                released: boutsReleased,
                scheduleDisplayByBoutId,
              }) ?? hint
          if (
            resolved &&
            (INTERNAL_WINNER_HINT.test(resolved) || INTERNAL_LOSER_HINT.test(resolved))
          ) {
            issues.push(
              `[brackets-ui] stale slot hint ${categoryKey} ${match.id} ${side}: "${resolved}"`,
            )
          }
        }
      }

      for (const slot of category.structure.bronzeSlots ?? []) {
        if (slot.id === 'bronze-fight') {
          const title = resolveBronzeFightTitle({
            matchId: slot.id,
            label: slot.label,
            categoryKey,
            scheduleDisplayByBoutId,
          })
          if (INTERNAL_BRONZE_TITLE.test(title)) {
            issues.push(`[brackets-ui] stale bronze title ${categoryKey}: "${title}"`)
          }
        } else {
          const resolved = resolveStaleAdvanceHintLabel({
            label: slot.label,
            categoryKey,
            released: boutsReleased,
            scheduleDisplayByBoutId,
          })
          if (resolved && INTERNAL_LOSER_HINT.test(resolved)) {
            issues.push(`[brackets-ui] stale bronze slot ${categoryKey} ${slot.id}: "${resolved}"`)
          }
        }

        for (const hint of [slot.hintA, slot.hintB]) {
          if (!hint) continue
          const parsed = parseInternalAdvanceHintLabel(hint)
          const resolved = parsed
            ? resolveStaleAdvanceHintLabel({
                label: hint,
                categoryKey,
                released: boutsReleased,
                scheduleDisplayByBoutId,
              })
            : hint
          if (resolved && (INTERNAL_WINNER_HINT.test(resolved) || INTERNAL_LOSER_HINT.test(resolved))) {
            issues.push(`[brackets-ui] stale bronze hint ${categoryKey} ${slot.id}: "${resolved}"`)
          }
        }
      }

      for (const pair of category.structure.roundRobinPairs ?? []) {
        const matchId = `rr-${pair.matchNumber}`
        const uiLabel = resolveBracketMatchLabel({
          categoryKey,
          matchId,
          label: undefined,
          matchNumber: pair.matchNumber,
          scheduleDisplayByBoutId,
        })
        if (/^Бой \d+$/.test(uiLabel)) {
          issues.push(
            `[brackets-ui] stale rr label ${categoryKey} ${matchId}: "${uiLabel}" (internal ${pair.matchNumber})`,
          )
        }
      }
    }
  }

  console.log(
    JSON.stringify(
      {
        boutCount: boutsData.mats.reduce((n, m) => n + m.bouts.length, 0),
        visibleBracketCategories: bracketsData?.categories.length ?? 0,
        scheduleDisplayMapSize: scheduleDisplayByBoutId.size,
        scheduleLegacyGap: boutsData.scheduleLegacyGap,
        issueCount: issues.length,
        issues: issues.slice(0, 50),
      },
      null,
      2,
    ),
  )

  if (issues.length > 0) process.exitCode = 1
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
