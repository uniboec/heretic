import { formatPhoneMask } from './phone'
import { normalizeAwardPackageId } from './config/award-packages'
import { normalizeCupId } from './config/cups'

export const DRAFT_KEY = 'survey-draft-v1'
export const DRAFT_TTL_MS = 24 * 60 * 60 * 1000

const CURRENT_ROLE_IDS = new Set(['coach', 'club_leader', 'coach_and_leader', 'other'])

const LEGACY_ROLE_MAP: Record<string, string> = {
  team_leader: 'coach_and_leader',
  representative: 'coach',
}

export function normalizeRoles(roles: string[]): string[] {
  if (!roles.length) return []

  const mapped = roles.map((role) =>
    CURRENT_ROLE_IDS.has(role) ? role : LEGACY_ROLE_MAP[role],
  )
  const first = mapped.find((role) => role && CURRENT_ROLE_IDS.has(role))
  return first ? [first] : []
}

export interface SurveyFormData {
  representativeName: string
  roles: string[]
  rolesOther: string
  organizationName: string
  city: string
  phone: string
  athletesCount: number | null
  disciplines: string[]
  acceptableVenues: string[]
  preferredVenue: string
  dayFormatPreference: string
  acceptableMedals: string[]
  preferredMedal: string
  acceptableBelts: string[]
  preferredBelt: string
  acceptableCups: string[]
  preferredCup: string
  acceptablePrizeCompositions: string[]
  acceptableAwardPackages: string[]
  priorities: string[]
  prioritiesOther: string
  comment: string
}

export const defaultFormData: SurveyFormData = {
  representativeName: '',
  roles: [],
  rolesOther: '',
  organizationName: '',
  city: '',
  phone: '',
  athletesCount: null,
  disciplines: [],
  acceptableVenues: [],
  preferredVenue: '',
  dayFormatPreference: '',
  acceptableMedals: [],
  preferredMedal: '',
  acceptableBelts: [],
  preferredBelt: '',
  acceptableCups: [],
  preferredCup: '',
  acceptablePrizeCompositions: [],
  acceptableAwardPackages: [],
  priorities: [],
  prioritiesOther: '',
  comment: '',
}

export interface SurveyDraft {
  savedAt: string
  submissionId: string
  data: SurveyFormData
}

export function loadDraft(): SurveyDraft | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(DRAFT_KEY)
    if (!raw) return null
    const draft = JSON.parse(raw) as SurveyDraft
    if (Date.now() - new Date(draft.savedAt).getTime() > DRAFT_TTL_MS) {
      localStorage.removeItem(DRAFT_KEY)
      return null
    }
    draft.data.roles = normalizeRoles(draft.data.roles)
    draft.data.disciplines = draft.data.disciplines ?? []
    draft.data.acceptableCups = (draft.data.acceptableCups ?? []).map(normalizeCupId)
    draft.data.preferredMedal = draft.data.preferredMedal ?? ''
    draft.data.preferredBelt = draft.data.preferredBelt ?? ''
    draft.data.preferredCup = normalizeCupId(draft.data.preferredCup ?? '')
    draft.data.acceptablePrizeCompositions = draft.data.acceptablePrizeCompositions ?? []
    if (draft.data.acceptableAwardPackages?.length) {
      draft.data.acceptableAwardPackages = draft.data.acceptableAwardPackages.map(
        normalizeAwardPackageId,
      )
    }
    if (draft.data.phone) {
      draft.data.phone = formatPhoneMask(draft.data.phone)
    }
    return draft
  } catch {
    return null
  }
}

export function saveDraft(draft: SurveyDraft): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(DRAFT_KEY, JSON.stringify(draft))
}

export function clearDraft(): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem(DRAFT_KEY)
}

export function createSubmissionId(): string {
  return crypto.randomUUID()
}
