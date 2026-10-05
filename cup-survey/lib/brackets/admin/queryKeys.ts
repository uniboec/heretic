export const bracketAdminQueryKeys = {
  all: ['admin-brackets'] as const,
  dashboard: () => [...bracketAdminQueryKeys.all, 'dashboard'] as const,
  structure: (categoryKey: string) =>
    [...bracketAdminQueryKeys.all, 'structure', categoryKey] as const,
}
