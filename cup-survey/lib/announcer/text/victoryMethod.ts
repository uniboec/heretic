const PHRASES: Record<string, string> = {
  POINTS: 'по очкам',
  CLEAR_ADVANTAGE: 'по явному преимуществу',
  SUBMISSION: 'болевым приёмом',
  CHOKE: 'удушающим приёмом',
  DISQUALIFICATION: 'в результате дисквалификации соперника',
  NO_SHOW: 'в связи с неявкой соперника',
  INJURY: 'из-за травмы соперника',
  FORFEIT: 'в связи с отказом соперника продолжать бой',
  TECHNICAL_SUPERIORITY: 'по техническому превосходству',
  KNOCKOUT: 'нокаутом',
  TECHNICAL_KNOCKOUT: 'техническим нокаутом',
}

export function victoryMethodPhrase(method: string): string {
  return PHRASES[method] ?? 'по решению судей'
}
