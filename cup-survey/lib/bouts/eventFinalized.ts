import { prisma } from '../prisma'
import { EventFinalizedError } from './mat-control/errors'

export async function isEventFinalized(): Promise<boolean> {
  const settings = await prisma.boutsPageSetting.findUnique({
    where: { id: 'default' },
    select: { eventFinalized: true },
  })
  return settings?.eventFinalized === true
}

export async function assertMatControlWritesAllowed(): Promise<void> {
  if (await isEventFinalized()) {
    throw new EventFinalizedError()
  }
}
