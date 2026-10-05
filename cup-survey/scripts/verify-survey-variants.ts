import { randomUUID } from 'crypto'
import { deriveAwardPackageIds } from '../lib/awardSelection'
import { disciplineIds } from '../lib/config/disciplines'
import { parseSurveyBody } from '../lib/validation/surveySchema'

type ScenarioInput = {
  name: string
  acceptableMedals: string[]
  preferredMedal?: string
  acceptablePrizeCompositions: string[]
  acceptableBelts?: string[]
  preferredBelt?: string
  acceptableCups?: string[]
  preferredCup?: string
  acceptableVenues?: string[]
  preferredVenue?: string
  dayFormatPreference?: string
  roles?: string[]
  rolesOther?: string
  disciplines?: string[]
  priorities?: string[]
  prioritiesOther?: string
  athletesCount?: number | null
  comment?: string
}

export const scenarios: ScenarioInput[] = [
  {
    name: 'Только медали · стандартные',
    acceptableMedals: ['standard'],
    acceptablePrizeCompositions: ['medals_only'],
    acceptableBelts: [],
    acceptableCups: [],
  },
  {
    name: 'Только медали · уникальные',
    acceptableMedals: ['custom'],
    acceptablePrizeCompositions: ['medals_only'],
    acceptableBelts: [],
    acceptableCups: [],
  },
  {
    name: 'Только медали · оба типа медалей',
    acceptableMedals: ['standard', 'custom'],
    preferredMedal: 'standard',
    acceptablePrizeCompositions: ['medals_only'],
    acceptableBelts: [],
    acceptableCups: [],
  },
  {
    name: 'Медали + пояса · от 4 участников',
    acceptableMedals: ['standard'],
    acceptablePrizeCompositions: ['medals_belts'],
    acceptableBelts: ['fourPlus'],
    acceptableCups: [],
  },
  {
    name: 'Медали + пояса · во всех категориях',
    acceptableMedals: ['custom'],
    acceptablePrizeCompositions: ['medals_belts'],
    acceptableBelts: ['all'],
    acceptableCups: [],
  },
  {
    name: 'Медали + пояса · оба варианта поясов',
    acceptableMedals: ['standard', 'custom'],
    preferredMedal: 'custom',
    acceptablePrizeCompositions: ['medals_belts'],
    acceptableBelts: ['fourPlus', 'all'],
    preferredBelt: 'fourPlus',
    acceptableCups: [],
  },
  {
    name: 'Медали + кубки · от 4 человек',
    acceptableMedals: ['standard'],
    acceptablePrizeCompositions: ['medals_cups'],
    acceptableBelts: [],
    acceptableCups: ['fourPlus'],
  },
  {
    name: 'Медали + кубки · во всех категориях',
    acceptableMedals: ['standard'],
    acceptablePrizeCompositions: ['medals_cups'],
    acceptableBelts: [],
    acceptableCups: ['all'],
  },
  {
    name: 'Медали + кубки · уникальные',
    acceptableMedals: ['custom'],
    acceptablePrizeCompositions: ['medals_cups'],
    acceptableBelts: [],
    acceptableCups: ['custom_fourPlus', 'custom_all'],
    preferredCup: 'custom_all',
  },
  {
    name: 'Полный комплект · все опции',
    acceptableMedals: ['standard', 'custom'],
    preferredMedal: 'standard',
    acceptablePrizeCompositions: ['medals_belts_cups'],
    acceptableBelts: ['fourPlus', 'all'],
    preferredBelt: 'all',
    acceptableCups: ['fourPlus', 'all', 'custom_fourPlus', 'custom_all'],
    preferredCup: 'fourPlus',
  },
  {
    name: 'Смешанно: только медали + пояса',
    acceptableMedals: ['standard', 'custom'],
    preferredMedal: 'standard',
    acceptablePrizeCompositions: ['medals_only', 'medals_belts'],
    acceptableBelts: ['fourPlus'],
    acceptableCups: [],
  },
  {
    name: 'Смешанно: только медали + кубки',
    acceptableMedals: ['standard'],
    acceptablePrizeCompositions: ['medals_only', 'medals_cups'],
    acceptableBelts: [],
    acceptableCups: ['fourPlus', 'all'],
    preferredCup: 'fourPlus',
  },
  {
    name: 'Смешанно: все комплектации',
    acceptableMedals: ['standard', 'custom'],
    preferredMedal: 'custom',
    acceptablePrizeCompositions: ['medals_only', 'medals_belts', 'medals_cups', 'medals_belts_cups'],
    acceptableBelts: ['fourPlus', 'all'],
    preferredBelt: 'fourPlus',
    acceptableCups: ['fourPlus', 'all'],
    preferredCup: 'all',
  },
  {
    name: 'Одна площадка',
    acceptableMedals: ['standard'],
    acceptablePrizeCompositions: ['medals_only'],
    acceptableBelts: [],
    acceptableCups: [],
    acceptableVenues: ['universal-fighters'],
    preferredVenue: 'universal-fighters',
  },
  {
    name: 'Несколько площадок',
    acceptableMedals: ['standard'],
    acceptablePrizeCompositions: ['medals_belts'],
    acceptableBelts: ['fourPlus'],
    acceptableCups: [],
    acceptableVenues: ['gtm', 'forum-metallurg', 'universal-fighters'],
    preferredVenue: 'forum-metallurg',
    dayFormatPreference: 'two_days_ok',
  },
  {
    name: 'Роль «Другое»',
    acceptableMedals: ['standard'],
    acceptablePrizeCompositions: ['medals_cups'],
    acceptableBelts: [],
    acceptableCups: ['fourPlus'],
    roles: ['other'],
    rolesOther: 'Судья соревнований',
  },
  {
    name: 'Приоритет «Другое»',
    acceptableMedals: ['custom'],
    acceptablePrizeCompositions: ['medals_only'],
    acceptableBelts: [],
    acceptableCups: [],
    priorities: ['other'],
    prioritiesOther: 'Удобный график для детей',
  },
  {
    name: 'Три приоритета',
    acceptableMedals: ['standard'],
    acceptablePrizeCompositions: ['medals_belts_cups'],
    acceptableBelts: ['fourPlus'],
    acceptableCups: ['all'],
    priorities: ['low_fee', 'one_day', 'unique_awards'],
  },
  {
    name: 'Все дисциплины',
    acceptableMedals: ['standard', 'custom'],
    preferredMedal: 'custom',
    acceptablePrizeCompositions: ['medals_only'],
    acceptableBelts: [],
    acceptableCups: [],
    disciplines: [...disciplineIds],
    athletesCount: 40,
  },
]

export function buildPayload(scenario: ScenarioInput) {
  const acceptableBelts = scenario.acceptableBelts ?? []
  const acceptableCups = scenario.acceptableCups ?? []
  const acceptableAwardPackages = deriveAwardPackageIds({
    acceptableMedals: scenario.acceptableMedals,
    acceptablePrizeCompositions: scenario.acceptablePrizeCompositions,
    acceptableBelts,
    acceptableCups,
  })

  if (!acceptableAwardPackages.length) {
    throw new Error('Не удалось вывести наградные пакеты')
  }

  return {
    submissionId: randomUUID(),
    representativeName: 'Тест Варианты Опроса',
    roles: scenario.roles ?? ['coach'],
    rolesOther: scenario.rolesOther,
    organizationName: `СК Тест ${scenario.name}`,
    city: 'Екатеринбург',
    phone: '+79001234567',
    athletesCount: scenario.athletesCount ?? 12,
    disciplines: scenario.disciplines ?? ['tactic_control', 'full_contact'],
    acceptableVenues: scenario.acceptableVenues ?? ['gtm'],
    preferredVenue: scenario.preferredVenue ?? scenario.acceptableVenues?.[0] ?? 'gtm',
    dayFormatPreference: scenario.dayFormatPreference ?? 'prefer_one_day',
    acceptableMedals: scenario.acceptableMedals,
    preferredMedal: scenario.preferredMedal ?? scenario.acceptableMedals[0] ?? '',
    acceptablePrizeCompositions: scenario.acceptablePrizeCompositions,
    acceptableBelts,
    preferredBelt: scenario.preferredBelt ?? acceptableBelts.find((id) => id !== 'none') ?? '',
    acceptableCups,
    preferredCup: scenario.preferredCup ?? acceptableCups.find((id) => id !== 'none') ?? '',
    acceptableAwardPackages,
    priorities: scenario.priorities ?? [],
    prioritiesOther: scenario.prioritiesOther,
    comment: scenario.comment ?? `variant: ${scenario.name}`,
  }
}

function exportPayloads() {
  return scenarios.map((scenario) => ({
    name: scenario.name,
    payload: buildPayload(scenario),
  }))
}

function main(): number {
  if (process.argv.includes('--export-json')) {
    console.log(JSON.stringify(exportPayloads()))
    return 0
  }

  let failed = 0

  for (const scenario of scenarios) {
    try {
      const payload = buildPayload(scenario)
      const parsed = parseSurveyBody(payload)
      if (!parsed.data) {
        failed += 1
        console.error(`FAIL  ${scenario.name}`)
        for (const err of parsed.errors ?? []) console.error(`      ${err}`)
        continue
      }
      console.log(
        `OK    ${scenario.name} · packages: ${payload.acceptableAwardPackages.length} · ${payload.acceptableAwardPackages.join(', ')}`,
      )
    } catch (error) {
      failed += 1
      console.error(`FAIL  ${scenario.name}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  console.log(`\n${scenarios.length - failed}/${scenarios.length} scenarios passed`)
  return failed === 0 ? 0 : 1
}

process.exitCode = main()
