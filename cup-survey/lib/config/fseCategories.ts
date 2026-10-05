/**
 * Возрастные и весовые категории для дисциплин Tactic-Control и Close-Control
 * по Правилам ФСЕ России, ред. 1.0.10 (22.08.2022), гл. 2.1 «Категории».
 * @see https://uniboec.ru/wp-content/uploads/2023/08/PRAVILA-FSE-ROSSII-1.0.10.pdf
 */

export const FSE_RULES_SOURCE =
  'Правила ФСЕ России, ред. 1.0.10 (22.08.2022), гл. 2.1'

export interface FseWeightCategory {
  id: string
  label: string
  maxWeight?: number
  minWeight?: number
}

export interface FseAgeDivision {
  id: string
  label: string
  gender: 'male' | 'female'
  ageMin: number
  ageMax: number | null
  weightCategories: FseWeightCategory[]
}

type WeightSpec = number | `${number}+`

function buildWeights(divisionId: string, specs: WeightSpec[]): FseWeightCategory[] {
  return specs.map((spec) => {
    if (typeof spec === 'number') {
      return {
        id: `${divisionId}_w_le_${spec}`,
        label: `до ${spec} кг`,
        maxWeight: spec,
      }
    }
    const min = Number(spec.replace('+', ''))
    return {
      id: `${divisionId}_w_gt_${min}`,
      label: `свыше ${min} кг`,
      minWeight: min,
    }
  })
}

function division(
  id: string,
  label: string,
  gender: 'male' | 'female',
  ageMin: number,
  ageMax: number | null,
  weights: WeightSpec[],
): FseAgeDivision {
  return {
    id,
    label,
    gender,
    ageMin,
    ageMax,
    weightCategories: buildWeights(id, weights),
  }
}

const maleWeightHeavy = [56, 61, 66, 71, 77, 84, 92, 100, '100+'] as WeightSpec[]

export const fseAgeDivisions: FseAgeDivision[] = [
  division('m_boys_1', 'Мальчики 1', 'male', 4, 5, [16, 18, 20, 22, 24, 26, 29, 32, '32+']),
  division('m_boys_2', 'Мальчики 2', 'male', 6, 7, [20, 22, 24, 26, 29, 32, 35, 38, '38+']),
  division('m_boys_3', 'Мальчики 3', 'male', 8, 9, [24, 26, 29, 32, 35, 38, 41, 44, '44+']),
  division('m_youths_1', 'Юноши 1', 'male', 10, 11, [29, 32, 35, 38, 41, 44, 48, 52, '52+']),
  division('m_youths_2', 'Юноши 2', 'male', 12, 13, [35, 38, 41, 44, 48, 52, 56, 61, '61+']),
  division('m_youths_3', 'Юноши 3', 'male', 14, 15, [41, 44, 48, 52, 56, 61, 66, 71, '71+']),
  division('m_juniors_1', 'Юниоры 1', 'male', 16, 17, [48, 52, 56, 61, 66, 71, 77, 84, '84+']),
  division('m_juniors_2', 'Юниоры 2', 'male', 18, 20, maleWeightHeavy),
  division('m_men_1', 'Мужчины 1', 'male', 18, 29, maleWeightHeavy),
  division('m_men_2', 'Мужчины 2', 'male', 30, null, maleWeightHeavy),
  division('m_veterans_1', 'Ветераны 1', 'male', 40, null, maleWeightHeavy),
  division('m_veterans_2', 'Ветераны 2', 'male', 50, null, maleWeightHeavy),
  division('m_veterans_3', 'Ветераны 3', 'male', 60, null, maleWeightHeavy),

  division('f_girls_1', 'Девочки 1', 'female', 4, 5, [16, 18, 20, 22, 24, 26, '26+']),
  division('f_girls_2', 'Девочки 2', 'female', 6, 7, [18, 20, 22, 24, 26, 29, '29+']),
  division('f_girls_3', 'Девочки 3', 'female', 8, 9, [22, 24, 26, 29, 32, 35, '35+']),
  division('f_girls_youth_1', 'Девушки 1', 'female', 10, 11, [26, 29, 32, 35, 38, 41, '41+']),
  division('f_girls_youth_2', 'Девушки 2', 'female', 12, 13, [32, 35, 38, 41, 44, 48, '48+']),
  division('f_girls_youth_3', 'Девушки 3', 'female', 14, 15, [38, 41, 44, 48, 52, 56, '56+']),
  division('f_juniors_1', 'Юниорки 1', 'female', 16, 17, [44, 48, 52, 56, 61, 66, '66+']),
  division('f_juniors_2', 'Юниорки 2', 'female', 18, 20, [52, 56, 61, 66, 71, 77, '77+']),
  division('f_women_1', 'Женщины 1', 'female', 18, 29, [52, 56, 61, 66, 71, 77, '77+']),
  division('f_women_2', 'Женщины 2', 'female', 30, null, [52, 56, 61, 66, 71, 77, '77+']),
  division('f_veterans_1', 'Ветераны 1', 'female', 40, null, [52, 56, 61, 66, 71, 77, '77+']),
  division('f_veterans_2', 'Ветераны 2', 'female', 50, null, [52, 56, 61, 66, 71, 77, '77+']),
  division('f_veterans_3', 'Ветераны 3', 'female', 60, null, [52, 56, 61, 66, 71, 77, '77+']),
]

const divisionMap = new Map(fseAgeDivisions.map((d) => [d.id, d]))
const weightMap = new Map<string, FseWeightCategory>()
for (const d of fseAgeDivisions) {
  for (const w of d.weightCategories) {
    weightMap.set(w.id, w)
  }
}

export function getAgeDivision(id: string): FseAgeDivision | undefined {
  return divisionMap.get(id)
}

export function getWeightCategory(id: string): FseWeightCategory | undefined {
  return weightMap.get(id)
}

function pluralYears(n: number): string {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return `${n} год`
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return `${n} года`
  return `${n} лет`
}

/** Возраст в обозначениях Правил ФСЕ: «18+ лет», «60+ лет», «4–5 лет» и т.д. */
export function formatAgeDivisionAgeRange(division: FseAgeDivision): string {
  if (division.ageMax == null) {
    return `${division.ageMin}+ лет`
  }
  if (division.ageMin === 18 && division.ageMax === 29) {
    return '18+ лет'
  }
  if (division.ageMin === division.ageMax) {
    return pluralYears(division.ageMin)
  }
  return `${division.ageMin}–${division.ageMax} лет`
}

export function getAgeDivisionAgeRangeLabel(id: string): string {
  const division = getAgeDivision(id)
  return division ? formatAgeDivisionAgeRange(division) : id
}

export function getAgeDivisionLabel(id: string): string {
  return getAgeDivision(id)?.label ?? id
}

/** Подпись для фильтров: без пола, если категории уже отфильтрованы по полу. */
export function formatAgeDivisionFilterLabel(
  division: FseAgeDivision,
  includeGender = false,
): string {
  const ageRange = formatAgeDivisionAgeRange(division)
  if (!includeGender) {
    return `${division.label} · ${ageRange}`
  }
  const genderPrefix = division.gender === 'male' ? 'Муж.' : 'Жен.'
  return `${genderPrefix} ${division.label} · ${ageRange}`
}

export function getWeightCategoryLabel(id: string): string {
  const known = getWeightCategory(id)
  if (known) return known.label

  const leMatch = id.match(/_w_le_(\d+)$/)
  if (leMatch) return `до ${leMatch[1]} кг`

  const gtMatch = id.match(/_w_gt_(\d+)$/)
  if (gtMatch) return `свыше ${gtMatch[1]} кг`

  const legacyMatch = id.match(/^w_(\d+\+?)$/)
  if (legacyMatch) {
    return legacyMatch[1].endsWith('+')
      ? `свыше ${legacyMatch[1].replace('+', '')} кг`
      : `до ${legacyMatch[1]} кг`
  }

  return id
}

export function getCompetitionCategoryLabel(ageDivisionId: string, weightCategoryId: string): string {
  const age = getAgeDivisionAgeRangeLabel(ageDivisionId)
  const weight = getWeightCategoryLabel(weightCategoryId)
  return `${age} · ${weight}`
}
