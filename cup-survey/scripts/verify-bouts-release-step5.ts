/**
 * Verify Phase 2 step 5 (bouts release) locally:
 * - features.independentBoutsRelease from admin API
 * - full workflow: publish → visible → release → /bouts read
 */
import { prisma } from '../lib/prisma'

const BASE = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'

async function adminFetch(path: string, init: RequestInit = {}, cookie?: string) {
  const headers = new Headers(init.headers)
  headers.set('Content-Type', 'application/json')
  if (cookie) headers.set('Cookie', cookie)
  const res = await fetch(`${BASE}${path}`, { ...init, headers })
  const json = await res.json().catch(() => ({}))
  return { res, json }
}

async function loginAdmin(): Promise<string | null> {
  const res = await fetch(`${BASE}/api/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: process.env.E2E_ADMIN_PASSWORD ?? 'admin' }),
  })
  if (!res.ok) return null
  const setCookie = res.headers.get('set-cookie')
  if (!setCookie) return null
  return setCookie.split(';')[0] ?? null
}

async function main() {
  console.log('=== Verify bouts release step 5 ===')
  console.log(`Base URL: ${BASE}`)

  for (let attempt = 0; attempt < 30; attempt++) {
    try {
      const health = await fetch(`${BASE}/api/health`)
      if (health.ok) break
    } catch {
      // wait
    }
    await new Promise((r) => setTimeout(r, 1000))
  }

  const cookie = await loginAdmin()
  if (!cookie) {
    console.error('FAIL: admin login failed (try E2E_ADMIN_PASSWORD=admin or set-admin-password)')
    process.exit(1)
  }
  console.log('OK: admin login')

  const { res: dashRes, json: dashboard } = await adminFetch('/api/admin/brackets', {}, cookie)
  if (!dashRes.ok) {
    console.error('FAIL: GET /api/admin/brackets', dashRes.status, dashboard)
    process.exit(1)
  }

  const phase2 = dashboard.features?.independentBoutsRelease === true
  console.log(`features.independentBoutsRelease = ${dashboard.features?.independentBoutsRelease}`)
  if (!phase2) {
    console.error('FAIL: Phase 2 flag not active — restart dev server after INDEPENDENT_BOUTS_RELEASE=true')
    process.exit(1)
  }
  console.log('OK: Phase 2 enabled in admin API')

  await prisma.boutsPageSetting.upsert({
    where: { id: 'default' },
    create: {
      publicEnabled: true,
      matCount: 3,
      autoMatAssignMode: 'BY_CATEGORY',
      autoMatByCategoryEnabled: true,
    },
    update: {
      publicEnabled: true,
      matCount: 3,
      autoMatAssignMode: 'BY_CATEGORY',
      autoMatByCategoryEnabled: true,
    },
  })
  await prisma.bracketPageSetting.update({
    where: { id: 'default' },
    data: { publicEnabled: true },
  })

  let draft = dashboard.draft
  if (!draft?.id) {
    console.error('FAIL: no draft in dashboard')
    process.exit(1)
  }

  async function generate(mode: 'SYNC' | 'REDRAW', scope: 'all' = 'all') {
    const { res, json } = await adminFetch(
      '/api/admin/brackets/generate',
      {
        method: 'POST',
        body: JSON.stringify({
          draftId: draft.id,
          expectedVersion: draft.version,
          mode,
          scope,
        }),
      },
      cookie ?? undefined,
    )
    if (!res.ok) throw new Error(`${mode} failed: ${JSON.stringify(json)}`)
    draft = json.draft
    return json
  }

  await generate('SYNC')
  await generate('REDRAW')

  const { res: pubRes, json: published } = await adminFetch(
    '/api/admin/brackets/publish',
    {
      method: 'POST',
      body: JSON.stringify({ draftId: draft.id, expectedVersion: draft.version }),
    },
    cookie,
  )
  if (!pubRes.ok) {
    console.error('FAIL: publish', published)
    process.exit(1)
  }
  console.log('OK: snapshot published')

  const { json: dash2 } = await adminFetch('/api/admin/brackets', {}, cookie)
  let category = dash2.categories?.find((c: { status: string }) => c.status === 'ACTIVE')

  const publishedGen = await prisma.bracketGeneration.findFirst({
    where: { singletonKey: 'live', status: 'ACTIVE' },
    orderBy: { publishedAt: 'desc' },
  })
  if (!publishedGen) {
    console.error('FAIL: no published generation in DB')
    process.exit(1)
  }

  if (!category) {
    const publishedDraw = await prisma.bracketCategoryDraw.findFirst({
      where: { generationId: publishedGen.id, status: 'ACTIVE' },
      include: { participants: true },
    })
    if (!publishedDraw) {
      console.error('FAIL: no ACTIVE published draw — run npm run seed:bracket-sizes && npm run brackets:sync')
      process.exit(1)
    }
    category = {
      categoryKey: publishedDraw.categoryKey,
      status: publishedDraw.status,
      publicationState: await prisma.bracketPublicationState.findUnique({
        where: { categoryKey: publishedDraw.categoryKey },
      }),
    }
    console.log(`Using published ACTIVE draw: ${category.categoryKey} (${publishedDraw.participants.length} participants)`)
  }

  const publishedGenerationId = publishedGen.id
  const pubState = await prisma.bracketPublicationState.findUnique({
    where: { categoryKey: category.categoryKey },
  })
  const publishedDrawId = pubState?.publishedDrawId
  if (!publishedDrawId) {
    console.error('FAIL: no publication state for category')
    process.exit(1)
  }

  const { res: visRes } = await adminFetch(
    '/api/admin/brackets/visibility',
    {
      method: 'POST',
      body: JSON.stringify({
        scope: 'category',
        categoryKey: category.categoryKey,
        visible: true,
      }),
    },
    cookie,
  )
  if (!visRes.ok) {
    console.error('FAIL: visibility toggle')
    process.exit(1)
  }
  console.log(`OK: category visible on /brackets: ${category.categoryKey}`)

  const { res: releaseRes, json: releaseBody } = await adminFetch(
    '/api/admin/brackets/bouts-release',
    {
      method: 'POST',
      body: JSON.stringify({
        scope: 'category',
        categoryKey: category.categoryKey,
        released: true,
        expectedPublishedDrawId: publishedDrawId,
        expectedPublishedGenerationId: publishedGenerationId,
      }),
    },
    cookie,
  )
  if (!releaseRes.ok) {
    console.error('FAIL: step 5 bouts-release', releaseBody)
    process.exit(1)
  }
  console.log('OK: step 5 — category released to /bouts', releaseBody)

  const boutsRes = await fetch(`${BASE}/api/tournament/bouts`)
  const bouts = await boutsRes.json().catch(() => null)
  if (!boutsRes.ok || !bouts?.published) {
    console.error('FAIL: public bouts endpoint', boutsRes.status, bouts)
    process.exit(1)
  }
  const allBouts = (bouts.mats ?? []).flatMap((mat: { bouts: { categoryKey: string }[] }) => mat.bouts)
  const hasCategory = allBouts.some(
    (bout: { categoryKey: string }) => bout.categoryKey === category.categoryKey,
  )
  if (!hasCategory) {
    console.error('FAIL: released category not on /bouts read model', {
      matCount: bouts.matCount,
      boutCount: allBouts.length,
    })
    process.exit(1)
  }
  console.log(`OK: category appears on /bouts (${allBouts.length} bouts across ${bouts.matCount} mats)`)

  const { json: dash3 } = await adminFetch('/api/admin/brackets', {}, cookie)
  const updated = dash3.categories?.find(
    (c: { categoryKey: string }) => c.categoryKey === category.categoryKey,
  )
  if (!updated?.boutsReleased) {
    console.error('FAIL: boutsReleased not set in admin dashboard')
    process.exit(1)
  }
  console.log('OK: admin dashboard shows boutsReleased=true')

  console.log('\n=== All step 5 checks passed ===')
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
