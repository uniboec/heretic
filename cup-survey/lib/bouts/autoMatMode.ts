export type AutoMatAssignMode =
  | 'BY_CATEGORY'
  | 'BY_BOUT'
  | 'BY_CATEGORY_TIME'
  | 'BY_BOUT_TIME'

export type AutoMatModeSettings = {
  autoMatAssignMode: AutoMatAssignMode
  autoMatByCategoryEnabled: boolean
}

export function isCategoryBatchMode(mode: AutoMatAssignMode): boolean {
  return mode === 'BY_CATEGORY' || mode === 'BY_CATEGORY_TIME'
}

export function isTimeWeightedMode(mode: AutoMatAssignMode): boolean {
  return mode === 'BY_BOUT_TIME' || mode === 'BY_CATEGORY_TIME'
}

export function getEffectiveAutoMatAssignMode(settings: AutoMatModeSettings): AutoMatAssignMode {
  if (!settings.autoMatByCategoryEnabled) {
    if (settings.autoMatAssignMode === 'BY_BOUT_TIME') {
      return 'BY_BOUT_TIME'
    }
    if (settings.autoMatAssignMode === 'BY_CATEGORY_TIME') {
      return 'BY_BOUT_TIME'
    }
    return 'BY_BOUT'
  }
  return settings.autoMatAssignMode
}
