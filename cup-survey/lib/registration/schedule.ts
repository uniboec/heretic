import { randomBytes } from 'crypto'
import {
  DEFAULT_MAX_ATHLETES,
  DEFAULT_SHOW_MAX_ATHLETES,
  registrationClosesAt as defaultRegistrationClosesAt,
  registrationStages as defaultStages,
  TOURNAMENT_TIMEZONE,
  type RegistrationStageConfig,
} from '../config/tournament'
import { prisma } from '../prisma'

export type RegistrationStageId = string

export interface RegistrationStageListItem {
  id: string
  label: string
  period: string
  pricePerDiscipline: number
}

export interface ResolvedRegistrationSchedule {
  stages: RegistrationStageConfig[]
  stagesById: Record<string, RegistrationStageConfig>
  stagesList: RegistrationStageListItem[]
  registrationClosesAt: string
  maxAthletes: number | null
  showMaxAthletes: boolean
}

export interface RegistrationStageInput {
  id?: string
  label: string
  bannerTitle?: string
  pricePerDiscipline: number
  startsAt: string | null
  endsAt: string
}

const CACHE_TTL_MS = 15_000

let cachedSchedule: ResolvedRegistrationSchedule | null = null
let cacheExpiresAt = 0

function formatDayMonth(iso: string): string {
  return new Intl.DateTimeFormat('ru-RU', {
    timeZone: TOURNAMENT_TIMEZONE,
    day: 'numeric',
    month: 'long',
  }).format(new Date(iso))
}

function formatDay(iso: string): string {
  return new Intl.DateTimeFormat('ru-RU', {
    timeZone: TOURNAMENT_TIMEZONE,
    day: 'numeric',
  }).format(new Date(iso))
}

function formatTime(iso: string): string {
  return new Intl.DateTimeFormat('ru-RU', {
    timeZone: TOURNAMENT_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(iso))
}

function formatMonthGenitive(iso: string): string {
  const parts = new Intl.DateTimeFormat('ru-RU', {
    timeZone: TOURNAMENT_TIMEZONE,
    month: 'long',
  }).formatToParts(new Date(iso))
  return parts.find((part) => part.type === 'month')?.value ?? ''
}

export function formatStagePeriod(
  stage: Pick<RegistrationStageConfig, 'startsAt' | 'endsAt'>,
  index: number,
): string {
  const endsAt = stage.endsAt
  const startsAt = stage.startsAt

  if (!startsAt && index === 0) {
    return `до ${formatDayMonth(endsAt)}`
  }

  if (!startsAt) {
    return `до ${formatDayMonth(endsAt)}`
  }

  const startMonth = formatMonthGenitive(startsAt)
  const endMonth = formatMonthGenitive(endsAt)
  const endTime = formatTime(endsAt)
  const sameDay = formatDayMonth(startsAt) === formatDayMonth(endsAt)

  if (sameDay) {
    return `${formatDayMonth(endsAt)}, до ${endTime}`
  }

  if (startMonth === endMonth) {
    return `${formatDay(startsAt)}–${formatDay(endsAt)} ${endMonth}`
  }

  return `${formatDayMonth(startsAt)} – ${formatDayMonth(endsAt)}`
}

function formatBannerDetail(stage: RegistrationStageConfig, index: number): string {
  if (!stage.startsAt && index === 0) {
    return `до ${formatDayMonth(stage.endsAt)}`
  }
  if (formatDayMonth(stage.startsAt ?? stage.endsAt) === formatDayMonth(stage.endsAt)) {
    return `${formatDayMonth(stage.endsAt)}, до ${formatTime(stage.endsAt)}`
  }
  return `до ${formatDayMonth(stage.endsAt)}`
}

function defaultStageConfigs(): RegistrationStageConfig[] {
  return [
    defaultStages.early,
    defaultStages.regular,
    defaultStages.late,
  ]
}

function buildResolvedSchedule(
  stages: RegistrationStageConfig[],
  registrationClosesAt: string,
  maxAthletes: number | null = DEFAULT_MAX_ATHLETES,
  showMaxAthletes: boolean = DEFAULT_SHOW_MAX_ATHLETES,
): ResolvedRegistrationSchedule {
  const stagesById = Object.fromEntries(stages.map((stage) => [stage.id, stage]))
  const stagesList = stages.map((stage, index) => ({
    id: stage.id,
    label: stage.label,
    period: formatStagePeriod(stage, index),
    pricePerDiscipline: stage.pricePerDiscipline,
  }))

  return {
    stages,
    stagesById,
    stagesList,
    registrationClosesAt,
    maxAthletes,
    showMaxAthletes,
  }
}

function mapDbStage(
  stage: {
    id: string
    label: string
    bannerTitle: string
    pricePerDiscipline: number
    startsAt: Date | null
    endsAt: Date
  },
  index: number,
): RegistrationStageConfig {
  const config: RegistrationStageConfig = {
    id: stage.id,
    label: stage.label,
    bannerTitle: stage.bannerTitle,
    bannerDetail: '',
    startsAt: stage.startsAt?.toISOString() ?? null,
    endsAt: stage.endsAt.toISOString(),
    pricePerDiscipline: stage.pricePerDiscipline,
  }
  config.bannerDetail = formatBannerDetail(config, index)
  return config
}

export function getDefaultRegistrationSchedule(): ResolvedRegistrationSchedule {
  return buildResolvedSchedule(defaultStageConfigs(), defaultRegistrationClosesAt)
}

export function getRegistrationScheduleSync(): ResolvedRegistrationSchedule {
  return cachedSchedule ?? getDefaultRegistrationSchedule()
}

export function getStageFromSchedule(stageId: string): RegistrationStageConfig | null {
  return getRegistrationScheduleSync().stagesById[stageId] ?? null
}

async function seedDefaultStagesIfEmpty(): Promise<void> {
  const count = await prisma.registrationStage.count()
  if (count > 0) return

  const defaults = defaultStageConfigs()
  await prisma.$transaction(
    defaults.map((stage, index) =>
      prisma.registrationStage.create({
        data: {
          id: stage.id,
          label: stage.label,
          bannerTitle: stage.bannerTitle,
          pricePerDiscipline: stage.pricePerDiscipline,
          startsAt: stage.startsAt ? new Date(stage.startsAt) : null,
          endsAt: new Date(stage.endsAt),
          sortOrder: index,
        },
      }),
    ),
  )
}

export async function loadRegistrationSchedule(): Promise<ResolvedRegistrationSchedule> {
  if (cachedSchedule && Date.now() < cacheExpiresAt) {
    return cachedSchedule
  }

  try {
    await seedDefaultStagesIfEmpty()

    const [dbStages, settings] = await Promise.all([
      prisma.registrationStage.findMany({ orderBy: { sortOrder: 'asc' } }),
      prisma.registrationScheduleSetting.findUnique({ where: { id: 'default' } }),
    ])

    const stages = dbStages.map((stage, index) => mapDbStage(stage, index))
    const registrationClosesAt =
      settings?.registrationClosesAt?.toISOString() ?? defaultRegistrationClosesAt
    const maxAthletes = settings?.maxAthletes ?? DEFAULT_MAX_ATHLETES
    const showMaxAthletes = settings?.showMaxAthletes ?? DEFAULT_SHOW_MAX_ATHLETES

    cachedSchedule = buildResolvedSchedule(
      stages,
      registrationClosesAt,
      maxAthletes,
      showMaxAthletes,
    )
  } catch {
    cachedSchedule = getDefaultRegistrationSchedule()
  }

  cacheExpiresAt = Date.now() + CACHE_TTL_MS

  const { syncUnpaidPricesForCurrentStage } = await import('./stagePricing')
  await syncUnpaidPricesForCurrentStage()

  return cachedSchedule
}

export function invalidateRegistrationScheduleCache(): void {
  cachedSchedule = null
  cacheExpiresAt = 0
}

export function createRegistrationStageId(label: string): string {
  const slug = label
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .slice(0, 32)

  if (slug) return slug
  return `stage-${randomBytes(4).toString('hex')}`
}

export function validateRegistrationScheduleInput(input: {
  registrationClosesAt: string | null
  stages: RegistrationStageInput[]
}): string[] {
  const errors: string[] = []

  if (!input.registrationClosesAt) {
    errors.push('Укажите дату и время закрытия регистрации.')
  }

  if (input.stages.length === 0) {
    errors.push('Добавьте хотя бы один этап регистрации.')
    return errors
  }

  for (const [index, stage] of input.stages.entries()) {
    if (!stage.label.trim()) {
      errors.push(`Этап ${index + 1}: укажите название.`)
    }
    if (!stage.endsAt) {
      errors.push(`Этап ${index + 1}: укажите дату окончания.`)
    }
    if (!Number.isFinite(stage.pricePerDiscipline) || stage.pricePerDiscipline < 0) {
      errors.push(`Этап ${index + 1}: укажите корректную стоимость.`)
    }
    if (index > 0 && !stage.startsAt) {
      errors.push(`Этап ${index + 1}: укажите дату начала.`)
    }
  }

  if (errors.length > 0) return errors

  const registrationClosesAt = new Date(input.registrationClosesAt!).getTime()
  const parsedStages = input.stages.map((stage, index) => ({
    index,
    label: stage.label.trim(),
    startsAt: index === 0 && !stage.startsAt ? null : new Date(stage.startsAt!).getTime(),
    endsAt: new Date(stage.endsAt).getTime(),
  }))

  for (const stage of parsedStages) {
    if (stage.startsAt != null && stage.endsAt < stage.startsAt) {
      errors.push(`Этап «${stage.label}»: окончание не может быть раньше начала.`)
    }
  }

  for (let index = 1; index < parsedStages.length; index += 1) {
    const previous = parsedStages[index - 1]
    const current = parsedStages[index]
    if (current.startsAt != null && current.startsAt <= previous.endsAt) {
      errors.push(
        `Этап «${current.label}» должен начинаться после окончания этапа «${previous.label}».`,
      )
    }
  }

  const lastStage = parsedStages[parsedStages.length - 1]
  if (registrationClosesAt < lastStage.endsAt) {
    errors.push('Закрытие регистрации не может быть раньше окончания последнего этапа.')
  }

  const ids = input.stages.map((stage) => stage.id).filter(Boolean)
  if (new Set(ids).size !== ids.length) {
    errors.push('Идентификаторы этапов должны быть уникальными.')
  }

  return errors
}
