import {
  Award,
  Columns2,
  Footprints,
  Medal,
  ScrollText,
  Star,
  Swords,
  Trophy,
  Users,
  type LucideIcon,
} from 'lucide-react'

export const essentialsFormatIcons = {
  disciplines: Swords,
  divisions: Users,
  mats: Columns2,
} as const satisfies Record<string, LucideIcon>

export const divisionCardIcons = {
  novice: Footprints,
  experienced: Award,
} as const satisfies Record<string, LucideIcon>

export const essentialsAwardIcons = {
  medal: Medal,
  diploma: ScrollText,
  trophy: Trophy,
  rank: Star,
} as const satisfies Record<string, LucideIcon>
