export function pointsToHundredths(points: number): number {
  return points * 100
}

export function applyAgeCoefficientHundredths(
  rawHundredths: number,
  ageCoeffPercent: number,
): number {
  return Math.round((rawHundredths * ageCoeffPercent) / 100)
}

export function formatRatingHundredths(hundredths: number): string {
  const negative = hundredths < 0
  const abs = Math.abs(hundredths)
  const whole = Math.floor(abs / 100)
  const fraction = abs % 100
  const fractionText = fraction.toString().padStart(2, '0')
  return `${negative ? '−' : ''}${whole},${fractionText}`
}

export function placeWithoutWinsHundredths(
  placePoints: number,
  placeWithoutWinPercent: number,
): number {
  return placePoints * placeWithoutWinPercent
}

export function placeWithWinsHundredths(placePoints: number): number {
  return placePoints * 100
}
