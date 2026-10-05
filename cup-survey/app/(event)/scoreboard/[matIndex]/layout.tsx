import type { Metadata } from 'next'
import { withBasePath } from '@/lib/basePath'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ matIndex: string }>
}): Promise<Metadata> {
  const { matIndex } = await params
  return {
    title: `Табло — ковёр ${matIndex}`,
    description: `Публичное табло поединка на ковре ${matIndex}`,
    manifest: withBasePath(`/api/scoreboard/${matIndex}/manifest`),
    appleWebApp: {
      capable: true,
      title: `Ковёр ${matIndex}`,
      statusBarStyle: 'black-translucent',
    },
  }
}

export default function ScoreboardLayout({ children }: { children: React.ReactNode }) {
  return children
}
