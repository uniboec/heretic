import { BracketOperationError } from './errors'

export function assertWorkingGeneration(generation: { status: string } | null | undefined): void {
  if (!generation || (generation.status !== 'DRAFT' && generation.status !== 'ACTIVE')) {
    throw new BracketOperationError(
      'GENERATION_NOT_DRAFT',
      'Операция доступна только для черновика сеток',
    )
  }
}
