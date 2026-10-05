import { prisma } from '../lib/prisma'
import { orderMatBoutsForRuntime } from '../lib/bouts/matRuntimeOrder'
import { readFullScheduleSnapshot } from '../lib/bouts/scheduleService'
import { getCategoryTitleFromKey } from '../lib/registration/categoryIdentity'

async function main() {
  const pipeline = await readFullScheduleSnapshot({ adminPreview: true })
  const matCount = pipeline.settings.matCount

  console.log('=== MAT QUEUE ORDER (runtime) ===\n')

  for (let matIndex = 1; matIndex <= matCount; matIndex += 1) {
    const mat = pipeline.grouped.mats.find((entry) => entry.matIndex === matIndex)
    if (!mat || mat.bouts.length === 0) continue

    const ordered = orderMatBoutsForRuntime({
      groupedMats: pipeline.grouped.mats,
      matIndex,
      overrides: pipeline.scheduleOverrides,
      settings: pipeline.settings,
    })

    console.log(`--- Mat ${matIndex} (${ordered.length} bouts) ---`)
    for (const [index, bout] of ordered.entries()) {
      const title = getCategoryTitleFromKey(bout.categoryKey)
      console.log(
        `${String(index + 1).padStart(2, ' ')}. ${bout.id.replace(/^[^:]+:[^:]+:[^:]+:[^:]+::/, '')} | ${title}`,
      )
    }
    console.log('')
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
