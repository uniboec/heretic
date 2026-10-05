import type {
  BracketCategoryDraw,
  BracketDrawParticipant,
  BracketGeneration,
  BracketPublicationState,
  Prisma,
} from '@prisma/client'
import { prisma } from '../../prisma'
import { resolvePublicGeneration } from '../live/generation'

const publishedDrawInclude = {
  generation: true,
  participants: { orderBy: { seedPosition: 'asc' as const } },
} as const

export type PublishedDrawWithRelations = BracketCategoryDraw & {
  generation: BracketGeneration
  participants: BracketDrawParticipant[]
}

export type PublicationStateFields = Pick<
  BracketPublicationState,
  | 'id'
  | 'categoryKey'
  | 'visible'
  | 'boutsReleased'
  | 'boutMatAssignments'
  | 'matCountAtRelease'
  | 'publishedDrawId'
  | 'scheduleOverrides'
  | 'updatedAt'
>

export type PublishedDrawPair = {
  publicationState: PublicationStateFields
  draw: PublishedDrawWithRelations
}

export type PublishedDrawRequire = 'visible' | 'boutsReleased'

export async function getActivePublishedGeneration(
  client: Prisma.TransactionClient | typeof prisma = prisma,
): Promise<BracketGeneration | null> {
  return resolvePublicGeneration(client)
}

async function loadPublicationStateRows(client: Prisma.TransactionClient | typeof prisma) {
  return client.bracketPublicationState.findMany({
    include: {
      publishedDraw: {
        include: publishedDrawInclude,
      },
    },
  })
}

function isExactPublishedDrawMatch(
  state: BracketPublicationState & { publishedDraw: PublishedDrawWithRelations },
  activeGeneration: BracketGeneration,
): boolean {
  return (
    state.publishedDrawId === state.publishedDraw.id &&
    state.publishedDraw.generationId === activeGeneration.id &&
    state.publishedDraw.status === 'ACTIVE'
  )
}

function mapPublicationState(state: BracketPublicationState): PublicationStateFields {
  return {
    id: state.id,
    categoryKey: state.categoryKey,
    visible: state.visible,
    boutsReleased: state.boutsReleased,
    boutMatAssignments: state.boutMatAssignments,
    matCountAtRelease: state.matCountAtRelease,
    publishedDrawId: state.publishedDrawId,
    scheduleOverrides: state.scheduleOverrides,
    updatedAt: state.updatedAt,
  }
}

export async function getCurrentPublishedDraws(input: {
  db?: Prisma.TransactionClient | typeof prisma
  activeGeneration?: BracketGeneration | null
  require?: PublishedDrawRequire
}): Promise<PublishedDrawPair[]> {
  const client = input.db ?? prisma
  const activeGeneration =
    input.activeGeneration !== undefined
      ? input.activeGeneration
      : await getActivePublishedGeneration(client)
  if (!activeGeneration) return []

  const publicationStates = await loadPublicationStateRows(client)
  let pairs = publicationStates
    .filter((state) => isExactPublishedDrawMatch(state, activeGeneration))
    .map((state) => ({
      publicationState: mapPublicationState(state),
      draw: state.publishedDraw,
    }))

  if (input.require === 'visible') {
    pairs = pairs.filter((pair) => pair.publicationState.visible)
  } else if (input.require === 'boutsReleased') {
    pairs = pairs.filter((pair) => pair.publicationState.boutsReleased)
  }

  return pairs
}

/** @deprecated use getCurrentPublishedDraws({ require: 'visible' }) */
export async function getActivePublishedDraws(
  activeGeneration: BracketGeneration,
  client: Prisma.TransactionClient | typeof prisma = prisma,
): Promise<PublishedDrawPair[]> {
  return getCurrentPublishedDraws({ db: client, activeGeneration })
}

/** @deprecated use getCurrentPublishedDraws({ require: 'visible' }) */
export async function getPublicVisiblePublishedDraws(
  activeGeneration: BracketGeneration,
  client: Prisma.TransactionClient | typeof prisma = prisma,
): Promise<PublishedDrawPair[]> {
  return getCurrentPublishedDraws({ db: client, activeGeneration, require: 'visible' })
}

export async function getBoutsReleasedPublishedDraws(
  activeGeneration: BracketGeneration,
  client: Prisma.TransactionClient | typeof prisma = prisma,
): Promise<PublishedDrawPair[]> {
  return getCurrentPublishedDraws({ db: client, activeGeneration, require: 'boutsReleased' })
}

export async function getActivePublishedDrawByCategoryKey(
  activeGeneration: BracketGeneration,
  categoryKey: string,
  client: Prisma.TransactionClient | typeof prisma = prisma,
): Promise<PublishedDrawPair | null> {
  const pairs = await getCurrentPublishedDraws({ db: client, activeGeneration })
  return pairs.find((pair) => pair.draw.categoryKey === categoryKey) ?? null
}
