import { describe, expect, it } from 'vitest'
import {
  createClientClock,
  pauseClientClock,
  readClientBoutElapsedMs,
  restoreClientClockAfterReload,
  startClientClock,
  stopClientClock,
} from '../clockFsm'

describe('client clock FSM', () => {
  it('reload while RUNNING becomes PAUSED with accumulated elapsed', () => {
    const running = startClientClock(createClientClock(1000), 5000)
    const restored = restoreClientClockAfterReload(running, 8000)
    expect(restored.state).toBe('PAUSED')
    expect(restored.accumulatedElapsedMs).toBe(4000)
  })

  it('tracks elapsed while running', () => {
    const running = startClientClock(createClientClock(0), 1000)
    expect(readClientBoutElapsedMs(running, 3500)).toBe(2500)
  })

  it('stop freezes elapsed time', () => {
    const stopped = stopClientClock(startClientClock(createClientClock(0), 1000), 4000)
    expect(stopped.state).toBe('STOPPED')
    expect(readClientBoutElapsedMs(stopped, 9000)).toBe(3000)
    expect(pauseClientClock(stopped, 9000).state).toBe('STOPPED')
  })
})
