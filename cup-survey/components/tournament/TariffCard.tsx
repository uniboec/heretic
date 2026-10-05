import { formatMoney } from '@/lib/formatMoney'
import { cn } from '@/lib/cn'

interface TariffCardProps {
  period: string
  pricePerDiscipline: number
  current?: boolean
  label?: string
  className?: string
}

export function TariffCard({
  period,
  pricePerDiscipline,
  current = false,
  label,
  className,
}: TariffCardProps) {
  return (
    <article
      className={cn(
        'relative rounded-card border border-border bg-surface px-4 py-5',
        current && 'border-accent bg-gradient-to-b from-accent-soft to-card shadow-card',
        className,
      )}
    >
      {current && (
        <span className="absolute top-3 right-3 rounded-full bg-accent px-2 py-0.5 text-[0.6875rem] font-bold uppercase text-card">
          Сейчас
        </span>
      )}
      {label && <p className="font-semibold text-foreground">{label}</p>}
      <p className="text-[0.9375rem] font-semibold text-muted">{period}</p>
      <p
        className={cn(
          'mt-2 text-[clamp(1.75rem,4vw,2.25rem)] font-extrabold text-foreground max-sm:text-2xl',
          current && 'text-accent',
        )}
      >
        {formatMoney(pricePerDiscipline, { plus: false })}
      </p>
      <p className="mt-0.5 text-[0.8125rem] text-muted">за категорию</p>
    </article>
  )
}
