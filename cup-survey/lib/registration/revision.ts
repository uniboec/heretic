import {
  bumpRegistrationRevisionInTransaction,
  runPostCommitBracketSync,
  withBracketImpactAfterCommit,
} from './bracketImpactCoordinator'

export {
  bumpRegistrationRevisionInTransaction,
  runPostCommitBracketSync,
  withBracketImpactAfterCommit,
} from './bracketImpactCoordinator'

/** Bump revision and run post-commit full sync. Safe for callers after a completed mutation. */
export async function bumpRegistrationRevision(_categoryKeys: string[] = []): Promise<void> {
  await bumpRegistrationRevisionInTransaction()
  await runPostCommitBracketSync()
}
