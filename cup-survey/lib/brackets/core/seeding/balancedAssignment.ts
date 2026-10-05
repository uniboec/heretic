import { createHash } from 'crypto'
import type { BracketParticipantInput } from '../types'
import { shuffleWithSeed } from './prng'
import {
  compareSemantic,
  scoreAssignment,
  type DrawAssignmentParticipant,
  type SemanticScore,
} from './scoreAssignment'
import { DEFAULT_MAX_SEARCH_NODES, getDefaultDrawPolicy } from './drawPolicy'
import { buildDrawBalanceReport, type DrawBalanceReport } from './drawBalanceReport'

export interface AssignBalancedDrawInput {
  participants: BracketParticipantInput[]
  drawSeed: string
  lockedPositions: Map<number, string>
  maxSearchNodes?: number
  /** Log-only budget; never changes chosen assignment or triggers fallback. */
  timeBudgetMs?: number
}

export interface AssignBalancedDrawResult {
  participants: BracketParticipantInput[]
  searchOptimal: boolean
  searchStats: {
    searchNodes: number
    maxSearchNodes: number
    elapsedMs: number
    usedGreedyCandidate: boolean
    choseGreedyOverBest: boolean
  }
  report: DrawBalanceReport
}

function toDrawParticipant(
  participant: BracketParticipantInput,
  drawPosition: number,
): DrawAssignmentParticipant {
  return {
    entryId: participant.entryId,
    strengthTier: participant.strengthTier ?? null,
    clubKey: participant.clubKey ?? null,
    cityKey: participant.cityKey ?? null,
    drawPosition,
    seedLocked: participant.seedLocked,
  }
}

function assignmentFromMap(
  participants: BracketParticipantInput[],
  assignment: Map<number, BracketParticipantInput>,
): DrawAssignmentParticipant[] {
  return [...assignment.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([position, participant]) => toDrawParticipant(participant, position))
}

function canonicalAssignmentHash(drawSeed: string, assignment: DrawAssignmentParticipant[]): bigint {
  const canonical = assignment
    .slice()
    .sort((a, b) => a.entryId.localeCompare(b.entryId))
    .map((participant) => `${participant.entryId}:${participant.drawPosition}`)
    .join('|')
  const hash = createHash('sha256').update(`${drawSeed}:${canonical}`).digest('hex')
  return BigInt(`0x${hash.slice(0, 16)}`)
}

function greedyFallback(
  participants: BracketParticipantInput[],
  lockedPositions: Map<number, string>,
  drawSeed: string,
): Map<number, BracketParticipantInput> {
  const byId = new Map(participants.map((participant) => [participant.entryId, participant]))
  const assignment = new Map<number, BracketParticipantInput>()
  for (const [position, entryId] of lockedPositions) {
    const participant = byId.get(entryId)
    if (participant) assignment.set(position, participant)
  }

  const lockedIds = new Set(lockedPositions.values())
  const unlocked = participants.filter((participant) => !lockedIds.has(participant.entryId))
  const availablePositions = Array.from({ length: participants.length }, (_, index) => index + 1).filter(
    (position) => !lockedPositions.has(position),
  )

  const participantOrder = shuffleWithSeed(
    unlocked.slice().sort((a, b) => a.entryId.localeCompare(b.entryId)),
    `${drawSeed}:greedy`,
  )
  const positionOrder = shuffleWithSeed(
    availablePositions.slice().sort((a, b) => a - b),
    `${drawSeed}:greedy:pos`,
  )

  for (let index = 0; index < participantOrder.length; index++) {
    assignment.set(positionOrder[index], participantOrder[index])
  }

  return assignment
}

function branchAndBoundSearch(
  participants: BracketParticipantInput[],
  lockedPositions: Map<number, string>,
  drawSeed: string,
  maxSearchNodes: number,
): {
  bestAssignment: Map<number, BracketParticipantInput> | null
  bestScore: SemanticScore | null
  searchNodes: number
  searchOptimal: boolean
} {
  const byId = new Map(participants.map((participant) => [participant.entryId, participant]))
  const assignment = new Map<number, BracketParticipantInput>()
  for (const [position, entryId] of lockedPositions) {
    const participant = byId.get(entryId)
    if (participant) assignment.set(position, participant)
  }

  const lockedIds = new Set(lockedPositions.values())
  const unlocked = participants.filter((participant) => !lockedIds.has(participant.entryId))
  const availablePositions = Array.from({ length: participants.length }, (_, index) => index + 1).filter(
    (position) => !lockedPositions.has(position),
  )

  const participantOrder = shuffleWithSeed(
    unlocked.slice().sort((a, b) => a.entryId.localeCompare(b.entryId)),
    drawSeed,
  )
  const positionOrder = shuffleWithSeed(
    availablePositions.slice().sort((a, b) => a - b),
    `${drawSeed}:pos`,
  )

  let bestAssignment: Map<number, BracketParticipantInput> | null = null
  let bestScore: SemanticScore | null = null
  let searchNodes = 0
  let searchOptimal = true

  function visit(
    depth: number,
    current: Map<number, BracketParticipantInput>,
    remainingPositions: number[],
  ) {
    searchNodes += 1
    if (searchNodes > maxSearchNodes) {
      searchOptimal = false
      return
    }

    if (depth === participantOrder.length) {
      const scored = assignmentFromMap(participants, current)
      const nextScore = scoreAssignment(scored, 0)
      if (!bestScore || compareSemantic(nextScore, bestScore) < 0) {
        bestScore = nextScore
        bestAssignment = new Map(current)
      }
      return
    }

    const participant = participantOrder[depth]
    for (let index = 0; index < remainingPositions.length; index++) {
      const position = remainingPositions[index]
      current.set(position, participant)
      const partialScore = scoreAssignment(assignmentFromMap(participants, current), 0)
      if (!bestScore || compareSemantic(partialScore, bestScore) <= 0) {
        const nextRemaining = remainingPositions.filter((_, i) => i !== index)
        visit(depth + 1, current, nextRemaining)
      }
      current.delete(position)
      if (!searchOptimal) return
    }
  }

  visit(0, assignment, positionOrder)
  return { bestAssignment, bestScore, searchNodes, searchOptimal }
}

export function assignBalancedDraw(input: AssignBalancedDrawInput): AssignBalancedDrawResult {
  const started = Date.now()
  const policy = getDefaultDrawPolicy()
  const maxSearchNodes = input.maxSearchNodes ?? DEFAULT_MAX_SEARCH_NODES
  const participantCount = input.participants.length

  if (participantCount <= 1) {
    const report = buildDrawBalanceReport({
      assignment: input.participants.map((participant) =>
        toDrawParticipant(participant, participant.seedPosition),
      ),
      searchOptimal: true,
      policy,
    })
    return {
      participants: input.participants,
      searchOptimal: true,
      searchStats: {
        searchNodes: 0,
        maxSearchNodes,
        elapsedMs: Date.now() - started,
        usedGreedyCandidate: false,
        choseGreedyOverBest: false,
      },
      report,
    }
  }

  const greedyMap = greedyFallback(input.participants, input.lockedPositions, input.drawSeed)
  const greedyScore = scoreAssignment(assignmentFromMap(input.participants, greedyMap), 0)

  const search = branchAndBoundSearch(
    input.participants,
    input.lockedPositions,
    input.drawSeed,
    maxSearchNodes,
  )

  let chosenMap = greedyMap
  let searchOptimal = false
  let choseGreedyOverBest = false
  let usedGreedyCandidate = true

  if (search.bestAssignment && search.bestScore) {
    usedGreedyCandidate = true
    if (compareSemantic(search.bestScore, greedyScore) < 0) {
      chosenMap = search.bestAssignment
      choseGreedyOverBest = false
      searchOptimal = search.searchOptimal
    } else if (compareSemantic(greedyScore, search.bestScore) < 0) {
      choseGreedyOverBest = true
      searchOptimal = false
    } else {
      const greedyHash = canonicalAssignmentHash(
        input.drawSeed,
        assignmentFromMap(input.participants, greedyMap),
      )
      const bestHash = canonicalAssignmentHash(
        input.drawSeed,
        assignmentFromMap(input.participants, search.bestAssignment),
      )
      if (bestHash < greedyHash) {
        chosenMap = search.bestAssignment
        choseGreedyOverBest = false
      } else {
        choseGreedyOverBest = true
      }
      searchOptimal = search.searchOptimal
    }
  }

  const resultParticipants = input.participants.map((participant) => {
    for (const [position, assigned] of chosenMap) {
      if (assigned.entryId === participant.entryId) {
        return { ...participant, seedPosition: position }
      }
    }
    return participant
  })

  const report = buildDrawBalanceReport({
    assignment: assignmentFromMap(input.participants, chosenMap),
    searchOptimal,
    policy,
  })

  const elapsedMs = Date.now() - started
  if (input.timeBudgetMs != null && elapsedMs > input.timeBudgetMs) {
    console.warn(
      `[balanced-draw] time budget exceeded: ${elapsedMs}ms > ${input.timeBudgetMs}ms (assignment unchanged)`,
    )
  }

  return {
    participants: resultParticipants,
    searchOptimal,
    searchStats: {
      searchNodes: search.searchNodes,
      maxSearchNodes,
      elapsedMs,
      usedGreedyCandidate,
      choseGreedyOverBest,
    },
    report,
  }
}
