import { getNormQualificationSettings, hasNormQualificationData } from './settings'

export async function getNormQualificationsVisibility(): Promise<{
  publicEnabled: boolean
  hasPublishedData: boolean
  normQualificationsPublicEnabled: boolean
}> {
  const settings = await getNormQualificationSettings()
  const hasPublishedData = await hasNormQualificationData(settings.tournamentScopeId)

  return {
    publicEnabled: settings.publicEnabled,
    hasPublishedData,
    normQualificationsPublicEnabled: settings.publicEnabled && hasPublishedData,
  }
}
