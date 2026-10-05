export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { assertPublishedSystemVersionsAvailable } = await import('./lib/brackets/deployGuard')
    try {
      await assertPublishedSystemVersionsAvailable()
    } catch (error) {
      console.error('Bracket deploy guard failed:', error)
      if (process.env.NODE_ENV === 'production') {
        throw error
      }
    }
  }
}
