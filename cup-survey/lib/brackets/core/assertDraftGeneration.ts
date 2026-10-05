import { BracketOperationError } from './errors'

export { assertWorkingGeneration } from './assertWorkingGeneration'

/** @deprecated use assertWorkingGeneration for DRAFT or ACTIVE generations */
export function assertDraftGeneration(generation: { status: string } | null | undefined): void {
  if (!generation || generation.status !== 'DRAFT') {
    throw new BracketOperationError(
      'GENERATION_NOT_DRAFT',
      'Операция доступна только для черновика сеток',
    )
  }
}
