import { beforeAll, beforeEach } from 'vitest'
import { prisma } from '../../../prisma'
import '../../systems'
import { isIntegrationTestDatabase } from '../../../db/integrationDatabaseUrl'
import { ensureBracketDefaults, purgeBracketIntegrationState } from './helpers'

export let dbAvailable = false

export function useIntegrationDb() {
  beforeAll(async () => {
    if (process.env.BRACKETS_INTEGRATION_TESTS !== '1') {
      dbAvailable = false
      return
    }

    if (!isIntegrationTestDatabase()) {
      dbAvailable = false
      return
    }

    try {
      await prisma.$queryRaw`SELECT 1`
      await ensureBracketDefaults()
      dbAvailable = true
    } catch {
      dbAvailable = false
    }
  })

  beforeEach(async (ctx) => {
    if (!dbAvailable) {
      ctx.skip()
      return
    }
    await purgeBracketIntegrationState()
  })
}
