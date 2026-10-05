/**
 * Registration validation + API flow tests.
 * Run: npx tsx scripts/test-registration-flow.ts
 */

import { PrismaClient } from '@prisma/client'
import { parseRegistrationCreateBody } from '../lib/validation/registrationCreateSchema'
import { calculateRegistrationTotal } from '../lib/registration/pricing'
import {
  getEligibleAgeDivisions,
  validateCategorySelection,
} from '../lib/registration/categoryRules'
import { isRankAllowedForAge, validateRankForBirthDate } from '../lib/registration/rankRules'
import { isExperienceLevelAllowed } from '../lib/config/experienceLevel'

const BASE = process.env.BASE_URL ?? 'http://localhost:3000'
const prisma = new PrismaClient()

type Result = { ok: boolean; name: string; detail?: string }
const results: Result[] = []

function pass(name: string, detail = '') {
  results.push({ ok: true, name, detail })
  console.log(`✓ ${name}${detail ? ` — ${detail}` : ''}`)
}

function fail(name: string, detail = '') {
  results.push({ ok: false, name, detail })
  console.error(`✗ ${name}${detail ? ` — ${detail}` : ''}`)
}

function uuid() {
  return crypto.randomUUID()
}

function validAthlete(overrides: Record<string, unknown> = {}) {
  return {
    lastName: 'Тестов',
    firstName: 'Иван',
    birthDate: '2012-05-15',
    gender: 'male',
    rank: 'none',
    disciplineEntries: [
      {
        discipline: 'tactic_control',
        ageDivisionId: 'm_youths_3',
        weightCategoryId: 'm_youths_3_w_le_41',
        experienceLevel: 'novice',
      },
    ],
    ...overrides,
  }
}

function validPayload(overrides: Record<string, unknown> = {}) {
  const suffix = Date.now().toString(36)
  return {
    clubName: 'Тестовый клуб',
    city: 'Первоуральск',
    phone: '+79001234567',
    email: `test-${suffix}@example.com`,
    athletes: [validAthlete()],
    consentPersonalData: true,
    consentPublication: true,
    editCode: 'test1234',
    deviceToken: uuid(),
    ...overrides,
  }
}

function testValidation() {
  console.log('\n=== Schema validation ===\n')

  const empty = parseRegistrationCreateBody({})
  if (!empty.data && empty.errors.length >= 5) pass('Empty payload rejected', `${empty.errors.length} errors`)
  else fail('Empty payload rejected')

  const noConsent = parseRegistrationCreateBody(validPayload({ consentPersonalData: false }))
  if (!noConsent.data) pass('Missing consent rejected')
  else fail('Missing consent rejected')

  const badPhone = parseRegistrationCreateBody(validPayload({ phone: '123' }))
  if (!badPhone.data) pass('Invalid phone rejected')
  else fail('Invalid phone rejected')

  const noCat = parseRegistrationCreateBody(
    validPayload({ athletes: [validAthlete({ disciplineEntries: [] })] }),
  )
  if (!noCat.data) pass('Athlete without categories rejected')
  else fail('Athlete without categories rejected')

  const dupEntry = {
    discipline: 'tactic_control',
    ageDivisionId: 'm_youths_3',
    weightCategoryId: 'm_youths_3_w_le_41',
    experienceLevel: 'novice',
  }
  const dup = parseRegistrationCreateBody(
    validPayload({ athletes: [validAthlete({ disciplineEntries: [dupEntry, dupEntry] })] }),
  )
  if (!dup.data && dup.errors.some((e) => e.includes('уже добавлена'))) pass('Duplicate category rejected')
  else fail('Duplicate category rejected', dup.errors?.join('; '))

  const badNovice = parseRegistrationCreateBody(
    validPayload({
      athletes: [
        validAthlete({
          rank: 'kms',
          disciplineEntries: [
            {
              discipline: 'tactic_control',
              ageDivisionId: 'm_youths_3',
              weightCategoryId: 'm_youths_3_w_le_41',
              experienceLevel: 'novice',
            },
          ],
        }),
      ],
    }),
  )
  if (!badNovice.data && badNovice.errors.some((e) => e.includes('Опытные'))) {
    pass('Novice + KMS rank rejected')
  } else {
    fail('Novice + KMS rank rejected')
  }

  const wrongAge = parseRegistrationCreateBody(
    validPayload({
      athletes: [
        validAthlete({
          birthDate: '2012-05-15',
          disciplineEntries: [
            {
              discipline: 'tactic_control',
              ageDivisionId: 'm_boys_1',
              weightCategoryId: 'm_boys_1_w_le_16',
              experienceLevel: 'novice',
            },
          ],
        }),
      ],
    }),
  )
  if (!wrongAge.data) pass('Wrong age division rejected')
  else fail('Wrong age division rejected')

  const shortCode = parseRegistrationCreateBody(validPayload({ editCode: 'ab' }))
  if (!shortCode.data) pass('Short edit code rejected')
  else fail('Short edit code rejected')

  const badDevice = parseRegistrationCreateBody(validPayload({ deviceToken: 'not-a-uuid' }))
  if (!badDevice.data) pass('Invalid device token rejected')
  else fail('Invalid device token rejected')

  const ok = parseRegistrationCreateBody(validPayload())
  if (ok.data) pass('Valid payload accepted')
  else fail('Valid payload accepted', ok.errors?.join('; '))
}

function testBusinessLogic() {
  console.log('\n=== Business logic ===\n')

  const total2 = calculateRegistrationTotal([{ entryCount: 2 }], 1500)
  if (total2.totalAmount === 3000) pass('Pricing: 2 × 1500 = 3000')
  else fail('Pricing total', String(total2.totalAmount))

  const catErr = validateCategorySelection({
    birthDate: '2012-05-15',
    gender: 'male',
    ageDivisionId: 'm_boys_1',
    weightCategoryId: 'm_boys_1_w_le_16',
  })
  if (catErr) pass('Category rules: 14yo cannot use boys_1')
  else fail('Category rules age check')

  if (!isExperienceLevelAllowed('kms', 'novice')) pass('KMS cannot be novice')
  else fail('KMS cannot be novice')

  if (isExperienceLevelAllowed('none', 'novice')) pass('No rank can be novice')
  else fail('No rank can be novice')

  if (isExperienceLevelAllowed('kms', 'experienced')) pass('KMS can be experienced')
  else fail('KMS can be experienced')

  const childDivisions = getEligibleAgeDivisions('2012-05-15', 'male')
  if (
    childDivisions.some((d) => d.id === 'm_youths_3') &&
    childDivisions.some((d) => d.id === 'm_juniors_1')
  ) {
    pass('Child age-up: own + higher division')
  } else {
    fail('Child age-up divisions', childDivisions.map((d) => d.id).join(', '))
  }

  const adultDivisions = getEligibleAgeDivisions('2000-05-15', 'male')
  if (!adultDivisions.some((d) => d.id === 'm_juniors_1')) {
    pass('Adult: no arbitrary youth age-up')
  } else {
    fail('Adult age-up leak', adultDivisions.map((d) => d.id).join(', '))
  }

  const ageUpOk = validateCategorySelection({
    birthDate: '2012-05-15',
    gender: 'male',
    ageDivisionId: 'm_juniors_1',
    weightCategoryId: 'm_juniors_1_w_le_48',
  })
  if (ageUpOk === null) pass('Validate child in higher age division')
  else fail('Validate child age-up', ageUpOk)

  const ageUpBad = validateCategorySelection({
    birthDate: '2012-05-15',
    gender: 'male',
    ageDivisionId: 'm_youths_2',
    weightCategoryId: 'm_youths_2_w_le_35',
  })
  if (ageUpBad) pass('Reject wrong age division for child')
  else fail('Should reject non-adjacent higher division')

  if (isRankAllowedForAge('child_3', 11) && !isRankAllowedForAge('child_3', 12)) {
    pass('Child rank only below 12')
  } else {
    fail('Child rank age rule')
  }

  if (isRankAllowedForAge('youth_2', 12) && isRankAllowedForAge('youth_2', 17) && !isRankAllowedForAge('youth_2', 18)) {
    pass('Youth rank 12-17 inclusive')
  } else {
    fail('Youth rank age rule')
  }

  if (isRankAllowedForAge('kms', 14) && !isRankAllowedForAge('kms', 13)) {
    pass('KMS from 14 years')
  } else {
    fail('KMS age rule')
  }

  if (isRankAllowedForAge('adult_1', 18) && isRankAllowedForAge('ms', 18) && !isRankAllowedForAge('adult_1', 17)) {
    pass('Adult ranks and MS from 18')
  } else {
    fail('Adult/MS age rule')
  }

  const badRank = validateRankForBirthDate('child_3', '2014-05-15')
  if (badRank) pass('Reject child rank for 12-year-old')
  else fail('Reject child rank for 12-year-old')
}

async function json(method: string, path: string, body?: unknown, headers: Record<string, string> = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
    body: body != null ? JSON.stringify(body) : undefined,
  })
  let data: unknown
  try {
    data = await res.json()
  } catch {
    data = null
  }
  return { status: res.status, data: data as Record<string, unknown> }
}

async function testApiFlow() {
  console.log('\n=== API flow ===\n')

  await prisma.rateLimitEntry.deleteMany({})

  const state = await json('GET', '/api/tournament/state')
  if (state.status === 200 && !state.data.closed) {
    pass('Tournament open', `stage=${(state.data.stage as { id?: string })?.id}`)
  } else {
    fail('Tournament open', JSON.stringify(state.data))
    return
  }

  const payload = validPayload({
    athletes: [
      validAthlete({
        disciplineEntries: [
          {
            discipline: 'tactic_control',
            ageDivisionId: 'm_youths_3',
            weightCategoryId: 'm_youths_3_w_le_41',
            experienceLevel: 'novice',
          },
          {
            discipline: 'close_control',
            ageDivisionId: 'm_youths_3',
            weightCategoryId: 'm_youths_3_w_le_44',
            experienceLevel: 'novice',
          },
        ],
      }),
    ],
  })

  const created = await json('POST', '/api/registrations', payload)
  if (created.status !== 201 || !created.data.id) {
    fail('POST create', JSON.stringify(created.data))
    return
  }

  const regId = created.data.id as string
  const editToken = created.data.editToken as string
  const deviceToken = payload.deviceToken as string
  pass('POST create', `id=${regId}`)

  if (created.data.totalAmount === 3000) pass('API total = 3000')
  else fail('API total', String(created.data.totalAmount))

  const got = await json('GET', `/api/registrations/${regId}`)
  const athletes = (got.data.athletes as Array<{ entries: unknown[] }>) ?? []
  if (got.status === 200 && athletes[0]?.entries?.length === 2) {
    pass('GET registration with 2 entries')
  } else {
    fail('GET registration', JSON.stringify(got.data))
  }

  const mine = await json('GET', '/api/registrations/mine', undefined, {
    'X-Registration-Device': deviceToken,
  })
  const regs = (mine.data.registrations as Array<{ id: string }>) ?? []
  if (mine.status === 200 && regs.some((r) => r.id === regId)) {
    pass('Mine list includes registration')
  } else {
    fail('Mine list', JSON.stringify(mine.data))
  }

  const newDevice = uuid()
  const unlock = await json('POST', '/api/registrations/unlock', {
    contact: payload.email,
    editCode: payload.editCode,
    deviceToken: newDevice,
  })
  if (unlock.status === 200 && unlock.data.registrationId === regId) {
    pass('Unlock by email + code')
  } else {
    fail('Unlock', JSON.stringify(unlock.data))
  }

  const editNoAuth = await json('GET', `/api/registrations/edit/${editToken}`)
  if (editNoAuth.status === 403) pass('Edit blocked without device')
  else fail('Edit auth gate', String(editNoAuth.status))

  const editAuth = await json('POST', `/api/registrations/edit/${editToken}/auth`, {
    editCode: payload.editCode,
    deviceToken: newDevice,
  })
  if (editAuth.status === 200) pass('Edit auth succeeds')
  else fail('Edit auth', JSON.stringify(editAuth.data))

  const editGet = await json('GET', `/api/registrations/edit/${editToken}`, undefined, {
    'X-Registration-Device': newDevice,
  })
  if (editGet.status === 200) pass('GET edit payload')
  else fail('GET edit', String(editGet.status))

  const badProof = await json('POST', `/api/registrations/${regId}/payment-proof`, {})
  if (badProof.status === 400) pass('Payment proof without file rejected')
  else fail('Payment proof validation', String(badProof.status))

  const badUnlock = await json('POST', '/api/registrations/unlock', {
    contact: payload.email,
    editCode: 'wrong1',
    deviceToken: uuid(),
  })
  if (badUnlock.status === 404 || badUnlock.status === 403) {
    pass('Wrong unlock code rejected')
  } else {
    fail('Wrong unlock code', String(badUnlock.status))
  }
}

async function main() {
  console.log(`Registration tests — ${BASE}`)
  testValidation()
  testBusinessLogic()
  await testApiFlow()

  const passed = results.filter((r) => r.ok).length
  const failed = results.filter((r) => !r.ok).length
  console.log(`\n--- ${passed} passed, ${failed} failed ---`)
  await prisma.$disconnect()
  if (failed > 0) process.exit(1)
}

main().catch(async (err) => {
  console.error(err)
  await prisma.$disconnect()
  process.exit(1)
})
