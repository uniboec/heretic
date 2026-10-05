export function isAdminCategoryExportCandidate(category: {
  status: string
  participants: unknown[]
}): boolean {
  return category.status === 'ACTIVE' && category.participants.length > 0
}
