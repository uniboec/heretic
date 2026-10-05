export function cornerLabel(corner: 'red' | 'blue', genitive = false): string {
  if (genitive) {
    return corner === 'red' ? 'красного угла' : 'синего угла'
  }
  return corner === 'red' ? 'красный угол' : 'синий угол'
}
