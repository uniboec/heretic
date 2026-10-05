import { BracketMoveAction, PrismaClient } from '@prisma/client'

function normalizeDatabaseUrl(url: string | undefined): string | undefined {
  if (!url) return url
  if (process.platform === 'win32') {
    return url.replace('@localhost:', '@127.0.0.1:')
  }
  return url
}

const databaseUrl = normalizeDatabaseUrl(process.env.DATABASE_URL)
if (databaseUrl && databaseUrl !== process.env.DATABASE_URL) {
  process.env.DATABASE_URL = databaseUrl
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
  prismaDatabaseUrl: string | undefined
  prismaClientFingerprint: string | undefined
}

const REQUIRED_PRISMA_DELEGATES = [
  'matControlSession',
  'boutControlCommand',
  'boutResult',
  'athleteRestState',
  'athleteRatingSetting',
] as const

function getPrismaClientFingerprint(): string {
  const bracketMoveActions =
    BracketMoveAction != null ? Object.values(BracketMoveAction).sort().join('|') : ''
  return [bracketMoveActions, REQUIRED_PRISMA_DELEGATES.join('|')].join(':')
}

function createPrismaClient() {
  return new PrismaClient({
    datasources: databaseUrl ? { db: { url: databaseUrl } } : undefined,
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  })
}

function isPrismaClientCompatible(client: PrismaClient): boolean {
  return REQUIRED_PRISMA_DELEGATES.every((delegate) => {
    const model = (client as unknown as Record<string, unknown>)[delegate]
    return Boolean(model && typeof model === 'object')
  })
}

const clientFingerprint = getPrismaClientFingerprint()

export const prisma =
  globalForPrisma.prismaDatabaseUrl === databaseUrl &&
  globalForPrisma.prismaClientFingerprint === clientFingerprint &&
  globalForPrisma.prisma &&
  isPrismaClientCompatible(globalForPrisma.prisma)
    ? globalForPrisma.prisma
    : createPrismaClient()

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
  globalForPrisma.prismaDatabaseUrl = databaseUrl
  globalForPrisma.prismaClientFingerprint = clientFingerprint
}
