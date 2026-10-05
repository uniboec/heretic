import { separateClubsExact } from '../lib/brackets/core/seeding/clubSeparation'
import type { BracketParticipantInput } from '../lib/brackets/core/types'

function buildParticipants(n: number): BracketParticipantInput[] {
  return Array.from({ length: n }, (_, i) => ({
    entryId: `e${i}`,
    displayName: `Athlete ${i}`,
    clubName: `Club ${i % 8}`,
    city: 'City',
    clubIdentity: `Club ${i % 8}::City`,
    publicNumber: i + 1,
    seedPosition: i + 1,
    seedLocked: false,
  }))
}

const n = 32
const start = performance.now()
const { report } = separateClubsExact(buildParticipants(n), 'benchmark-seed', new Map())
const elapsed = performance.now() - start

console.log(`club separation N=${n}: ${elapsed.toFixed(1)}ms, conflicts=${report.conflicts}`)
if (elapsed > 500) {
  console.warn('WARN: exceeds 500ms local budget')
  process.exitCode = 1
}
