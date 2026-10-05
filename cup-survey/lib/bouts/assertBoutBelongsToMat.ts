import { BoutNotOnMatError } from './mat-control/errors'

export function assertBoutBelongsToMat(boutId: string, matIndex: number, boutMatIndex: number): void {
  if (boutMatIndex !== matIndex) {
    throw new BoutNotOnMatError(
      `Поединок ${boutId} назначен на ковёр ${boutMatIndex}, а не ${matIndex}`,
    )
  }
}
