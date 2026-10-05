import { MatControlWorkspace } from '@/components/admin/bouts/mat-control/MatControlWorkspace'

export const dynamic = 'force-dynamic'

export default async function MatControlPage({
  params,
}: {
  params: Promise<{ matIndex: string }>
}) {
  const { matIndex } = await params
  const parsed = Number.parseInt(matIndex, 10)
  return <MatControlWorkspace matIndex={Number.isFinite(parsed) ? parsed : 1} />
}
