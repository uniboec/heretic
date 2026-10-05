import { formatMoney } from '@/lib/formatMoney'
import { cn } from '@/lib/cn'
import { hasClubDiscount } from '@/lib/registration/pricing'
import {
  pricePlainClass,
  priceWithDiscountClass,
  priceWithDiscountNewClass,
  priceWithDiscountOldClass,
} from '@/lib/ui/eventSurfaceStyles'

interface PriceWithDiscountProps {
  amount: number
  originalAmount?: number | null
  className?: string
  size?: 'sm' | 'md' | 'lg'
  align?: 'left' | 'right'
}

export function PriceWithDiscount({
  amount,
  originalAmount,
  className,
  size = 'md',
  align = 'left',
}: PriceWithDiscountProps) {
  const showDiscount = originalAmount != null && hasClubDiscount(originalAmount, amount)

  if (!showDiscount) {
    return (
      <span className={pricePlainClass(size, className)}>
        {formatMoney(amount, { plus: false })}
      </span>
    )
  }

  return (
    <span className={priceWithDiscountClass(size, align, className)}>
      <span className={priceWithDiscountOldClass()}>{formatMoney(originalAmount, { plus: false })}</span>
      <span className={priceWithDiscountNewClass(size)}>{formatMoney(amount, { plus: false })}</span>
    </span>
  )
}
