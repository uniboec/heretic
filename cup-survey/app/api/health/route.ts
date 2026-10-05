import { access } from 'node:fs/promises'
import { constants } from 'node:fs'
import { NextResponse } from 'next/server'
import { assertPublishedSystemVersionsAvailable } from '@/lib/brackets/deployGuard'
import { prisma } from '@/lib/prisma'

const PAYMENT_PROOFS_DIR =
  process.env.PAYMENT_PROOFS_DIR ?? '/app/data/payment-proofs'

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`
    await access(PAYMENT_PROOFS_DIR, constants.R_OK)
    await assertPublishedSystemVersionsAvailable()
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Health check failed:', error)
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Health check failed',
      },
      { status: 503 },
    )
  }
}
