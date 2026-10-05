let deferredAwardSync = false

async function runAwardAnnouncerSync(): Promise<void> {
  const { syncAwardAnnouncerState } = await import('./awardHooks')
  const { kickAnnouncerWorker } = await import('../worker')
  await syncAwardAnnouncerState()
  kickAnnouncerWorker()
}

export function deferAwardAnnouncerSync(): void {
  deferredAwardSync = true
}

export function flushAwardAnnouncerSyncIfDeferred(): void {
  if (!deferredAwardSync) return
  deferredAwardSync = false
  void runAwardAnnouncerSync()
}

export function scheduleAwardAnnouncerSync(): void {
  void runAwardAnnouncerSync()
}
