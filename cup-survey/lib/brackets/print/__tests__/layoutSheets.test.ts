import { describe, expect, it } from 'vitest'
import { buildBracketPrintModel } from '../buildBracketPrintModel'
import { renderHeadToHeadSheet } from '../layoutEngine/sheets/headToHeadSheet'
import { renderOlympicFourSheet } from '../layoutEngine/sheets/olympicFourSheet'
import { renderThreeWaySheet } from '../layoutEngine/sheets/threeWaySheet'
import type { BracketExportCategory } from '../../export/types'

function makeParticipant(
  seed: number,
  name: string,
  entryId = `e-${seed}`,
): BracketExportCategory['participants'][number] {
  return {
    entryId,
    seedPosition: seed,
    displayName: name,
    clubName: `КСЕ «Патриот ${seed}»`,
    city: 'Свердловская область',
  }
}

function baseCategory(partial: Partial<BracketExportCategory>): BracketExportCategory {
  return {
    categoryKey: 'test',
    title: 'Тест · Категория',
    discipline: 'Клоус Контрол',
    competitionStage: 1,
    matIndex: 1,
    participantCount: 2,
    effectiveSystemId: 'olympic',
    effectiveBronzeMode: 'TWO',
    participants: [],
    structure: { systemId: 'olympic', rounds: [], bronzeSlots: [] },
    boutOutcomes: {},
    result: null,
    ...partial,
  } as BracketExportCategory
}

function parseSvgRects(svg: string): Array<{ x: number; y: number; width: number; height: number }> {
  const rects: Array<{ x: number; y: number; width: number; height: number }> = []
  const re = /<rect x="([\d.]+)" y="([\d.]+)" width="([\d.]+)" height="([\d.]+)"/g
  let m: RegExpExecArray | null
  while ((m = re.exec(svg)) !== null) {
    rects.push({
      x: Number(m[1]),
      y: Number(m[2]),
      width: Number(m[3]),
      height: Number(m[4]),
    })
  }
  return rects
}

function intersects(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number },
): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y
}

describe('layout sheets collision checks', () => {
  it('head-to-head uses content-driven viewBox without tiny canvas', () => {
    const category = baseCategory({
      participantCount: 2,
      effectiveSystemId: 'olympic',
      participants: [
        makeParticipant(1, 'Иванов Иван Иванович'),
        makeParticipant(2, 'Петров Пётр Петрович'),
      ],
      structure: {
        systemId: 'olympic',
        rounds: [
          {
            id: 'f1',
            round: 1,
            slot: 1,
            matchNumber: 1,
            participantA: makeParticipant(1, 'Иванов Иван Иванович'),
            participantB: makeParticipant(2, 'Петров Пётр Петрович'),
          },
        ],
        bronzeSlots: [],
      },
    })

    const model = buildBracketPrintModel(category)
    const page = model.pages[0]!
    expect(page.svgDocument).toBeTruthy()
    expect(page.viewBoxWidth).not.toBe(720)
    expect(page.viewBoxHeight).toBeLessThan(600)
    expect(page.viewBoxHeight).toBeGreaterThan(280)

    const rendered = renderHeadToHeadSheet(category)
    const scoreBoxes = parseSvgRects(rendered.svg).filter((r) => r.width >= 50 && r.height >= 22)
    const badges = parseSvgRects(rendered.svg).filter((r) => r.height === 20 && r.width < 80)
    for (const badge of badges) {
      for (const box of scoreBoxes) {
        expect(intersects(badge, box)).toBe(false)
      }
    }
  })

  it('olympic four is landscape with connected graph', () => {
    const p = [
      makeParticipant(1, 'Соколов'),
      makeParticipant(2, 'Потапов'),
      makeParticipant(3, 'Скрябин'),
      makeParticipant(4, 'Самиев'),
    ]
    const category = baseCategory({
      participantCount: 4,
      effectiveSystemId: 'olympic',
      effectiveBronzeMode: 'TWO',
      boutsReleased: true,
      scheduleDisplayByBoutId: {
        'test::sf1': '2-10',
        'test::sf2': '2-11',
        'test::fin': '2-12',
      },
      participants: p,
      structure: {
        systemId: 'olympic',
        rounds: [
          { id: 'sf1', round: 1, slot: 1, matchNumber: 1, participantA: p[0], participantB: p[3] },
          { id: 'sf2', round: 1, slot: 2, matchNumber: 2, participantA: p[1], participantB: p[2] },
          {
            id: 'fin',
            round: 2,
            slot: 1,
            matchNumber: 3,
            slotSourceA: { matchId: 'sf1', outcome: 'winner' },
            slotSourceB: { matchId: 'sf2', outcome: 'winner' },
          },
        ],
        bronzeSlots: [],
      },
    })

    const model = buildBracketPrintModel(category)
    expect(model.orientation).toBe('landscape')
    const rendered = renderOlympicFourSheet(category)
    expect(rendered.svg).toContain('ПОЛУФИНАЛЫ')
    expect(rendered.svg).toContain('Проигравший боя 2-10')
    expect(rendered.svg.match(/<path /g)?.length ?? 0).toBeGreaterThan(6)
  })

  it('three-way final badge is not placed on third-place line', () => {
    const p = [
      makeParticipant(1, 'Иванов'),
      makeParticipant(2, 'Петров'),
      makeParticipant(3, 'Сидоров'),
    ]
    const category = baseCategory({
      participantCount: 3,
      effectiveSystemId: 'three_way',
      participants: p,
      structure: {
        systemId: 'three_way',
        rounds: [
          { id: 'b1', round: 1, slot: 1, matchNumber: 1, participantA: p[0], participantB: p[1] },
          {
            id: 'b2',
            round: 2,
            slot: 1,
            matchNumber: 2,
            slotSourceA: { matchId: 'b1', outcome: 'loser' },
            participantB: p[2],
          },
          {
            id: 'b3',
            round: 3,
            slot: 1,
            matchNumber: 3,
            slotSourceA: { matchId: 'b1', outcome: 'winner' },
            slotSourceB: { matchId: 'b2', outcome: 'winner' },
          },
        ],
        bronzeSlots: [],
      },
    })

    const rendered = renderThreeWaySheet(category)
    expect(rendered.svg).toContain('W1')
    expect(rendered.svg).toContain('L1')
    expect(rendered.svg).toContain('3 место')
    const badgeMatch = rendered.svg.match(/Бой №3/)
    expect(badgeMatch).toBeTruthy()
  })
})
