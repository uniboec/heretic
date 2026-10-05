export type ClientClockState = 'IDLE' | 'RUNNING' | 'PAUSED' | 'STOPPED'

export type ClientClockSnapshot = {
  state: ClientClockState
  accumulatedElapsedMs: number
  runningSincePerfMs: number | null
}

export function createClientClock(initialElapsedMs = 0): ClientClockSnapshot {
  return {
    state: 'IDLE',
    accumulatedElapsedMs: initialElapsedMs,
    runningSincePerfMs: null,
  }
}

export function restoreClientClockAfterReload(
  snapshot: ClientClockSnapshot,
  nowPerfMs: number,
): ClientClockSnapshot {
  if (snapshot.state !== 'RUNNING') {
    return snapshot
  }
  const runningSince = snapshot.runningSincePerfMs ?? nowPerfMs
  const delta = Math.max(0, nowPerfMs - runningSince)
  return {
    state: 'PAUSED',
    accumulatedElapsedMs: snapshot.accumulatedElapsedMs + delta,
    runningSincePerfMs: null,
  }
}

export function startClientClock(
  snapshot: ClientClockSnapshot,
  nowPerfMs: number,
): ClientClockSnapshot {
  if (snapshot.state === 'RUNNING') return snapshot
  return {
    ...snapshot,
    state: 'RUNNING',
    runningSincePerfMs: nowPerfMs,
  }
}

export function pauseClientClock(
  snapshot: ClientClockSnapshot,
  nowPerfMs: number,
): ClientClockSnapshot {
  if (snapshot.state !== 'RUNNING') return snapshot
  const runningSince = snapshot.runningSincePerfMs ?? nowPerfMs
  return {
    state: 'PAUSED',
    accumulatedElapsedMs: snapshot.accumulatedElapsedMs + Math.max(0, nowPerfMs - runningSince),
    runningSincePerfMs: null,
  }
}

export function stopClientClock(
  snapshot: ClientClockSnapshot,
  nowPerfMs: number,
): ClientClockSnapshot {
  const paused = pauseClientClock(snapshot, nowPerfMs)
  return { ...paused, state: 'STOPPED' }
}

export function readClientBoutElapsedMs(snapshot: ClientClockSnapshot, nowPerfMs: number): number {
  if (snapshot.state !== 'RUNNING' || snapshot.runningSincePerfMs == null) {
    return snapshot.accumulatedElapsedMs
  }
  return snapshot.accumulatedElapsedMs + Math.max(0, nowPerfMs - snapshot.runningSincePerfMs)
}
