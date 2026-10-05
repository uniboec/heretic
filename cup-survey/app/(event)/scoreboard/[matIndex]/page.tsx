import { MatScoreboardView } from '@/components/tournament/MatScoreboardView'

export const dynamic = 'force-dynamic'

export default async function MatScoreboardPage({
  params,
}: {
  params: Promise<{ matIndex: string }>
}) {
  const { matIndex } = await params
  const parsed = Number.parseInt(matIndex, 10)
  return <MatScoreboardView matIndex={Number.isFinite(parsed) ? parsed : 1} />
}
