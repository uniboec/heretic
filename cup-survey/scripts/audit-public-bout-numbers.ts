import { getPublicBouts } from '../lib/bouts/service'
import { prisma } from '../lib/prisma'

const INTERNAL_WINNER_HINT = /^Победитель боя (\d+)$/
const INTERNAL_LOSER_HINT = /^Проигравший боя (\d+)$/
const INTERNAL_BOUT_LABEL = /^Бой (\d+)$/

async function main() {
  const data = await getPublicBouts()
  if (!data) {
    console.log('Public bouts disabled')
    return
  }

  const issues: string[] = []
  let boutCount = 0
  let hintCount = 0
  let emptyDisplayNumber = 0
  const displayNumbers = new Map<string, string>()

  for (const mat of data.mats) {
    for (const bout of mat.bouts) {
      boutCount += 1
      if (!bout.scheduleDisplayNumber) {
        emptyDisplayNumber += 1
        issues.push(`empty scheduleDisplayNumber: ${bout.id}`)
      } else {
        const key = data.matsEnabled
          ? `${bout.matNumber ?? mat.matIndex}:${bout.scheduleDisplayNumber}`
          : bout.scheduleDisplayNumber
        if (displayNumbers.has(key)) {
          issues.push(`duplicate display number ${key}: ${bout.id} vs ${displayNumbers.get(key)}`)
        }
        displayNumbers.set(key, bout.id)
      }

      if ('matchNumber' in bout) {
        issues.push(`matchNumber leaked to public DTO: ${bout.id}`)
      }

      for (const side of [bout.sideA, bout.sideB]) {
        if (side.kind !== 'hint' || !side.label) continue
        hintCount += 1
        if (INTERNAL_WINNER_HINT.test(side.label) || INTERNAL_LOSER_HINT.test(side.label)) {
          issues.push(`stale internal hint on ${bout.id}: "${side.label}" (bout ${bout.scheduleDisplayNumber})`)
        }
      }

      if (bout.label && INTERNAL_BOUT_LABEL.test(bout.label)) {
        issues.push(`stale internal bout.label on ${bout.id}: "${bout.label}"`)
      }
    }
  }

  console.log(
    JSON.stringify(
      {
        boutCount,
        hintCount,
        emptyDisplayNumber,
        scheduleLegacyGap: data.scheduleLegacyGap,
        matsEnabled: data.matsEnabled,
        issueCount: issues.length,
        issues: issues.slice(0, 30),
      },
      null,
      2,
    ),
  )

  if (issues.length > 0) {
    process.exitCode = 1
  }
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
