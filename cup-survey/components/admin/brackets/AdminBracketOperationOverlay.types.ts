export type BracketOperationKind =
  | 'syncAll'
  | 'syncCategory'
  | 'redrawAll'
  | 'redrawAllForce'
  | 'redrawCategory'
  | 'reset'
  | 'backup'
  | 'restoreBackup'
  | 'forceRebuild'
  | 'consolidation'
  | 'settings'
  | null
