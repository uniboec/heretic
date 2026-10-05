import { NextResponse } from 'next/server'
import { announcerErrorResponse } from '@/lib/announcer/api'
import { requireAnnouncerAdmin } from '@/lib/announcer/adminAuth'
import { listCueSounds } from '@/lib/announcer/cuesServer'
import { TOURNAMENT_SCOPE_ID } from '@/lib/config/tournament'
import { announcerHeaders } from '@/lib/announcer/routeConfig'
import { defaultVoiceForProvider, listTtsProviders } from '@/lib/announcer/tts/registry'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  const auth = await requireAnnouncerAdmin()
  if (!auth.ok) return auth.response

  try {
    const providers = await Promise.all(
      listTtsProviders().map(async (provider) => {
        let healthy = false
        try {
          healthy = await provider.healthCheck()
        } catch {
          healthy = false
        }
        const voices = await provider.getVoices().catch(() => [])
        return {
          id: provider.id,
          label: provider.id,
          healthy,
          defaultVoiceId: defaultVoiceForProvider(provider.id),
          voices,
        }
      }),
    )

    const cueSounds = await listCueSounds(TOURNAMENT_SCOPE_ID)

    return NextResponse.json(
      {
        providers,
        cueSounds: cueSounds.map((sound) => ({
          id: sound.id,
          label: sound.label,
          family: sound.family,
          durationMs: sound.durationMs,
        })),
      },
      { headers: announcerHeaders },
    )
  } catch (error) {
    return announcerErrorResponse(error)
  }
}
