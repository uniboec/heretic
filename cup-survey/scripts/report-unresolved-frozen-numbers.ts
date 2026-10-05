import { rebuildLegacyFrozenScheduleNumbers } from '../lib/bouts/rebuildLegacyFrozenScheduleNumbers'

async function main() {
  const dryRun = process.argv.includes('--dry-run')
  const result = await rebuildLegacyFrozenScheduleNumbers({ dryRun })
  console.log(JSON.stringify(result, null, 2))

  if (!result.invariantOk) {
    process.exitCode = 1
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
