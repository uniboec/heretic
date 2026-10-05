import { withBasePath } from '@/lib/basePath'

export const dynamic = 'force-dynamic'

export async function GET(
  _request: Request,
  context: { params: Promise<{ matIndex: string }> },
) {
  const { matIndex } = await context.params
  const startUrl = withBasePath(`/scoreboard/${matIndex}`)
  const manifest = {
    name: `Табло ковра ${matIndex}`,
    short_name: `Ковёр ${matIndex}`,
    description: 'Публичное табло поединка на ковре',
    display: 'standalone',
    orientation: 'landscape',
    background_color: '#0f172a',
    theme_color: '#0f172a',
    start_url: startUrl,
    scope: withBasePath('/scoreboard/'),
    icons: [
      {
        src: withBasePath('/images/fse-federation.png'),
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any maskable',
      },
    ],
  }

  return new Response(JSON.stringify(manifest), {
    headers: {
      'Content-Type': 'application/manifest+json',
      'Cache-Control': 'no-store',
    },
  })
}
