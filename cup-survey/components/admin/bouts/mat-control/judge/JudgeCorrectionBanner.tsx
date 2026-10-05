'use client'

import { judgeStyles } from './judgeModeStyles'

export function JudgeCorrectionBanner({
  title,
  subtitle,
}: {
  title: string
  subtitle: string
}) {
  return (
    <div className={judgeStyles.correctionBanner}>
      <p className={judgeStyles.correctionBannerTitle}>{title}</p>
      <p className={judgeStyles.correctionBannerSubtitle}>{subtitle}</p>
    </div>
  )
}
