import {
  adminBoutsMatRange,
  adminBoutsMatRangeLabel,
  adminBoutsMatRangeSep,
  adminBoutsMatRangeValue,
} from '@/lib/ui/adminSurfaceStyles'

interface AdminMatScheduleRangeProps {
  startTime: string
  endTime?: string | null
}

export function AdminMatScheduleRange({ startTime, endTime }: AdminMatScheduleRangeProps) {
  return (
    <p className={adminBoutsMatRange}>
      <span className={adminBoutsMatRangeLabel}>Начало</span>
      <span className={adminBoutsMatRangeValue}>{startTime}</span>
      {endTime ? (
        <>
          <span className={adminBoutsMatRangeSep} aria-hidden="true">→</span>
          <span className={adminBoutsMatRangeLabel}>Конец</span>
          <span className={adminBoutsMatRangeValue}>≈ {endTime}</span>
        </>
      ) : null}
    </p>
  )
}
