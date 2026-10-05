import type { AnnouncerNameFormat } from '@prisma/client'
import { parseDisplayName } from '@/lib/awards/placements'

export function formatAthleteName(
  displayName: string,
  format: AnnouncerNameFormat,
  parts?: { lastName: string; firstName: string; middleName?: string | null },
): string {
  const parsed = parts ?? parseDisplayName(displayName)
  if (format === 'LAST_FIRST_MIDDLE' && parsed.middleName) {
    return `${parsed.lastName} ${parsed.firstName} ${parsed.middleName}`.trim()
  }
  return `${parsed.lastName} ${parsed.firstName}`.trim()
}
