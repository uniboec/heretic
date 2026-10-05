import { cn } from '@/lib/cn'
import {
  adminStatCard,
  adminStatLabel,
  adminStatValue,
} from '@/lib/ui/adminSurfaceStyles'

interface AdminStatCardProps {
  label: string
  value: string
  className?: string
  valueClassName?: string
}

export function AdminStatCard({ label, value, className, valueClassName }: AdminStatCardProps) {
  return (
    <div className={cn(adminStatCard, className)}>
      <p className={adminStatLabel}>{label}</p>
      <p className={cn(adminStatValue, valueClassName)}>{value}</p>
    </div>
  )
}
