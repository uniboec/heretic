'use client'

export function waitForBracketLayout(frameCount = 3): Promise<void> {
  return new Promise((resolve) => {
    let remaining = frameCount
    const step = () => {
      remaining -= 1
      if (remaining <= 0) {
        resolve()
        return
      }
      requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  })
}
