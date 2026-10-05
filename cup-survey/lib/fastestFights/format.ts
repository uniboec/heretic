import { formatBoutElapsedTime } from '@/components/admin/bouts/mat-control/judge/judgeUtils'

export function formatFastestFightTime(ms: number): string {
  return formatBoutElapsedTime(ms)
}
