import { Prisma } from '@prisma/client'
import { NextResponse } from 'next/server'
import { verifyAdminSession } from '@/lib/auth'
import { apiErrorResponse } from '@/lib/http/apiErrorResponse'
import {
  fromTournamentDatetimeLocalValue,
  toTournamentDatetimeLocalValue,
} from '@/lib/datetime/tournament'
import { prisma } from '@/lib/prisma'
import {
  createRegistrationStageId,
  getDefaultRegistrationSchedule,
  invalidateRegistrationScheduleCache,
  loadRegistrationSchedule,
  type RegistrationStageInput,
  validateRegistrationScheduleInput,
} from '@/lib/registration/schedule'
import { getCurrentRegistrationStage, getServerNow } from '@/lib/registration/time'
import { countActiveAthletes } from '@/lib/registration/service'
import { recalculateAllUnpaidEntryPrices } from '@/lib/registration/categoryDiscounts'
import { resetUnpaidStagePricingSync } from '@/lib/registration/stagePricing'

interface StageFormItem {
  id: string
  label: string
  bannerTitle: string
  pricePerDiscipline: number
  startsAt: string
  endsAt: string
  usageCount: number
}

function stageToFormItem(
  stage: {
    id: string
    label: string
    bannerTitle: string
    pricePerDiscipline: number
    startsAt: string | null
    endsAt: string
  },
  usageCount: number,
): StageFormItem {
  return {
    id: stage.id,
    label: stage.label,
    bannerTitle: stage.bannerTitle,
    pricePerDiscipline: stage.pricePerDiscipline,
    startsAt: stage.startsAt ? toTournamentDatetimeLocalValue(stage.startsAt) : '',
    endsAt: toTournamentDatetimeLocalValue(stage.endsAt),
    usageCount,
  }
}

async function getStageUsageCounts(): Promise<Record<string, number>> {
  const rows = await prisma.teamRegistration.groupBy({
    by: ['registrationStage'],
    _count: { _all: true },
  })

  return Object.fromEntries(rows.map((row) => [row.registrationStage, row._count._all]))
}

function parseStageInput(
  stage: Record<string, unknown>,
  index: number,
  existingIds: Set<string>,
): RegistrationStageInput {
  const label = String(stage.label ?? '').trim()
  const rawId = String(stage.id ?? '').trim()
  const id = rawId || createRegistrationStageId(label)

  if (existingIds.has(id)) {
    throw new Error(`DUPLICATE_STAGE_ID:${id}`)
  }
  existingIds.add(id)

  return {
    id,
    label,
    bannerTitle: String(stage.bannerTitle ?? label).trim() || label,
    pricePerDiscipline: Number(stage.pricePerDiscipline),
    startsAt:
      index === 0
        ? fromTournamentDatetimeLocalValue(String(stage.startsAt ?? ''), { inclusiveEnd: false })
        : fromTournamentDatetimeLocalValue(String(stage.startsAt ?? '')),
    endsAt: fromTournamentDatetimeLocalValue(String(stage.endsAt ?? ''), { inclusiveEnd: true })!,
  }
}

function parseMaxAthletes(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const num = Number(value)
  if (!Number.isInteger(num) || num < 1) {
    throw new Error('INVALID_MAX_ATHLETES')
  }
  return num
}

function buildSettingsResponse(
  schedule: Awaited<ReturnType<typeof loadRegistrationSchedule>>,
  usageCounts: Record<string, number>,
  currentStageId: string | null,
  currentAthleteCount: number,
) {
  return {
    schedule,
    stages: schedule.stages.map((stage) => stageToFormItem(stage, usageCounts[stage.id] ?? 0)),
    registrationClosesAt: toTournamentDatetimeLocalValue(schedule.registrationClosesAt),
    maxAthletes: schedule.maxAthletes,
    showMaxAthletes: schedule.showMaxAthletes,
    currentAthleteCount,
    defaults: getDefaultRegistrationSchedule(),
    currentStageId,
  }
}

export async function GET() {
  if (!(await verifyAdminSession())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const schedule = await loadRegistrationSchedule()
    const usageCounts = await getStageUsageCounts()
    const currentStageId = getCurrentRegistrationStage(getServerNow())
    const currentAthleteCount = await countActiveAthletes()

    return NextResponse.json(
      buildSettingsResponse(schedule, usageCounts, currentStageId, currentAthleteCount),
    )
  } catch (error) {
    console.error('GET /api/admin/registration-schedule failed', error)
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      (error.code === 'P2022' || error.code === 'P2021')
    ) {
      return NextResponse.json({ error: 'DB_MIGRATION_REQUIRED' }, { status: 500 })
    }
    return apiErrorResponse(error)
  }
}

export async function PATCH(request: Request) {
  if (!(await verifyAdminSession())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object' || !Array.isArray(body.stages)) {
    return NextResponse.json({ error: 'INVALID_BODY' }, { status: 400 })
  }

  const registrationClosesAt = fromTournamentDatetimeLocalValue(body.registrationClosesAt, {
    inclusiveEnd: true,
  })

  let maxAthletes: number | null
  try {
    maxAthletes = parseMaxAthletes(body.maxAthletes)
  } catch {
    return NextResponse.json(
      { errors: ['Укажите корректный лимит участников — целое число от 1 или оставьте поле пустым.'] },
      { status: 400 },
    )
  }

  const showMaxAthletes = Boolean(body.showMaxAthletes)

  let parsedStages: RegistrationStageInput[]
  try {
    const existingIds = new Set<string>()
    parsedStages = body.stages.map((stage: Record<string, unknown>, index: number) =>
      parseStageInput(stage, index, existingIds),
    )
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('DUPLICATE_STAGE_ID:')) {
      return NextResponse.json({ errors: ['Идентификаторы этапов должны быть уникальными.'] }, { status: 400 })
    }
    return NextResponse.json({ error: 'INVALID_BODY' }, { status: 400 })
  }

  const errors = validateRegistrationScheduleInput({
    registrationClosesAt,
    stages: parsedStages,
  })
  if (errors.length > 0) {
    return NextResponse.json({ errors }, { status: 400 })
  }

  try {
    const usageCounts = await getStageUsageCounts()
    const nextIds = new Set(parsedStages.map((stage) => stage.id!))
    const removedStages = Object.keys(usageCounts).filter((stageId) => !nextIds.has(stageId))

    if (removedStages.length > 0) {
      const blocked = removedStages.filter((stageId) => (usageCounts[stageId] ?? 0) > 0)
      if (blocked.length > 0) {
        return NextResponse.json(
          {
            errors: [
              `Нельзя удалить этап, по которому уже есть заявки: ${blocked.join(', ')}.`,
            ],
          },
          { status: 400 },
        )
      }
    }

    await prisma.$transaction(async (tx) => {
      await tx.registrationStage.deleteMany()
      await Promise.all(
        parsedStages.map((stage, index) =>
          tx.registrationStage.create({
            data: {
              id: stage.id!,
              label: stage.label,
              bannerTitle: stage.bannerTitle ?? stage.label,
              pricePerDiscipline: stage.pricePerDiscipline,
              startsAt: stage.startsAt ? new Date(stage.startsAt) : null,
              endsAt: new Date(stage.endsAt),
              sortOrder: index,
            },
          }),
        ),
      )

      await tx.registrationScheduleSetting.upsert({
        where: { id: 'default' },
        create: {
          id: 'default',
          registrationClosesAt: new Date(registrationClosesAt!),
          maxAthletes,
          showMaxAthletes,
        },
        update: {
          registrationClosesAt: new Date(registrationClosesAt!),
          maxAthletes,
          showMaxAthletes,
        },
      })
    })

    invalidateRegistrationScheduleCache()
    resetUnpaidStagePricingSync()
    await recalculateAllUnpaidEntryPrices()
    const schedule = await loadRegistrationSchedule()
    const updatedUsageCounts = await getStageUsageCounts()
    const currentAthleteCount = await countActiveAthletes()

    return NextResponse.json({
      success: true,
      ...buildSettingsResponse(
        schedule,
        updatedUsageCounts,
        getCurrentRegistrationStage(getServerNow()),
        currentAthleteCount,
      ),
    })
  } catch (error) {
    console.error('PATCH /api/admin/registration-schedule failed', error)
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      (error.code === 'P2022' || error.code === 'P2021')
    ) {
      return NextResponse.json({ error: 'DB_MIGRATION_REQUIRED' }, { status: 500 })
    }
    return apiErrorResponse(error)
  }
}
