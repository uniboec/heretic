export type PrizeCompositionId =
  | 'medals_only'
  | 'medals_belts'
  | 'medals_cups'
  | 'medals_belts_cups'

export interface PrizeComposition {
  id: PrizeCompositionId
  title: string
  description: string
  needsBelts: boolean
  needsCups: boolean
}

export const prizeCompositions: PrizeComposition[] = [
  {
    id: 'medals_only',
    title: 'Только медали',
    description: 'Медали призёрам, без чемпионских поясов и кубков.',
    needsBelts: false,
    needsCups: false,
  },
  {
    id: 'medals_belts',
    title: 'Медали + пояса',
    description: 'Медали призёрам и чемпионские пояса победителям.',
    needsBelts: true,
    needsCups: false,
  },
  {
    id: 'medals_cups',
    title: 'Медали + кубки',
    description: 'Медали призёрам и кубки победителям в категориях.',
    needsBelts: false,
    needsCups: true,
  },
  {
    id: 'medals_belts_cups',
    title: 'Медали + пояса + кубки',
    description: 'Полный комплект: медали, пояса и кубки.',
    needsBelts: true,
    needsCups: true,
  },
]

export const prizeCompositionIds = prizeCompositions.map((c) => c.id)

export function compositionNeedsBelts(ids: string[]): boolean {
  return ids.some((id) => id === 'medals_belts' || id === 'medals_belts_cups')
}

export function compositionNeedsCups(ids: string[]): boolean {
  return ids.some((id) => id === 'medals_cups' || id === 'medals_belts_cups')
}
