import type { CommitBoutPackageInput, CommitPackageEvent, ReconcileCandidateResult } from './types'

export type StagedEventLike = {
  sequenceNo: number
  commandId: string
  eventHash: string
  type: string
  boutElapsedMs: number
  payload: Record<string, unknown>
}

export function reconcileCandidate(
  staged: StagedEventLike[],
  packageInput: CommitBoutPackageInput,
): ReconcileCandidateResult {
  const errors: string[] = []
  const stagedSorted = [...staged].sort((a, b) => a.sequenceNo - b.sequenceNo)
  const packageSorted = [...packageInput.events].sort((a, b) => a.sequenceNo - b.sequenceNo)

  if (stagedSorted.length > packageSorted.length) {
    errors.push('Server has events beyond client package log')
    return { ok: false, errors }
  }

  for (let i = 0; i < stagedSorted.length; i++) {
    const serverEvent = stagedSorted[i]
    const clientEvent = packageSorted[i]
    if (!clientEvent) {
      errors.push(`Missing client event at sequence ${serverEvent.sequenceNo}`)
      continue
    }
    if (
      serverEvent.sequenceNo !== clientEvent.sequenceNo ||
      serverEvent.commandId !== clientEvent.commandId ||
      serverEvent.eventHash !== clientEvent.eventHash
    ) {
      errors.push(
        `Prefix mismatch at sequence ${serverEvent.sequenceNo}: server/client event identity diverged`,
      )
    }
  }

  if (errors.length > 0) {
    return { ok: false, errors }
  }

  const suffix = packageSorted.slice(stagedSorted.length)
  const suffixErrors = validateClientSuffix(suffix, stagedSorted.length)
  if (suffixErrors.length > 0) {
    return { ok: false, errors: suffixErrors }
  }

  return { ok: true, suffix }
}

function validateClientSuffix(suffix: CommitPackageEvent[], prefixLength: number): string[] {
  const errors: string[] = []
  let expectedSequence = prefixLength + 1

  for (const event of suffix) {
    if (event.sequenceNo !== expectedSequence) {
      errors.push(`Suffix sequence gap: expected ${expectedSequence}, got ${event.sequenceNo}`)
    }
    if (!event.commandId) {
      errors.push(`Suffix event at ${event.sequenceNo} missing commandId`)
    }
    if (!event.eventHash) {
      errors.push(`Suffix event at ${event.sequenceNo} missing eventHash`)
    }
    if (!event.type) {
      errors.push(`Suffix event at ${event.sequenceNo} missing type`)
    }
    expectedSequence += 1
  }

  return errors
}
