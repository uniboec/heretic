import { prisma } from '../prisma'
import { incrementRegistrationRevision } from './core/locks'

export async function bumpRegistrationRevision(): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await incrementRegistrationRevision(tx)
  })
}
