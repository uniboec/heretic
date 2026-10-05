export function scheduleMatAnnouncerSync(): void {
  void (async () => {
    const { syncAllMatsAnnouncerState } = await import('./matHooks')
    const { kickAnnouncerWorker } = await import('../worker')
    await syncAllMatsAnnouncerState()
    kickAnnouncerWorker()
  })()
}
