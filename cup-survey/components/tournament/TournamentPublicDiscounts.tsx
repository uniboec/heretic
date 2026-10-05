import { Percent } from 'lucide-react'
import { formatTournamentDateTime } from '@/lib/datetime/tournament'
import type { PublicCategoryDiscountPromotion } from '@/lib/registration/categoryDiscounts'

function formatPromotionPeriod(discount: PublicCategoryDiscountPromotion): string | null {
  if (!discount.startsAt && !discount.endsAt) return null

  if (discount.startsAt && discount.endsAt) {
    return `Действует с ${formatTournamentDateTime(discount.startsAt)} по ${formatTournamentDateTime(discount.endsAt)}`
  }
  if (discount.startsAt) {
    return `Действует с ${formatTournamentDateTime(discount.startsAt)}`
  }
  return `Действует до ${formatTournamentDateTime(discount.endsAt)}`
}

export function TournamentPublicDiscounts({
  discounts,
}: {
  discounts: PublicCategoryDiscountPromotion[]
}) {
  if (discounts.length === 0) return null

  return (
    <section
      id="discounts"
      className="scroll-mt-28 rounded-card border border-success/18 bg-gradient-to-br from-[#f0fdf4] via-card to-[#f8fffb] p-4 shadow-[inset_0_1px_0_rgb(34_197_94/0.05)] md:px-5 md:py-[1.125rem]"
      aria-labelledby="public-discounts-title"
    >
      <div className="mb-3.5">
        <p className="text-[0.6875rem] font-extrabold uppercase tracking-widest text-[#15803d]">
          Специальные условия
        </p>
        <h2
          id="public-discounts-title"
          className="mt-0.5 text-[1.0625rem] font-extrabold leading-snug tracking-tight text-foreground"
        >
          Действующие скидки
        </h2>
        <p className="mt-1.5 text-sm leading-snug text-muted">
          Скидки применяются автоматически при регистрации в подходящие категории.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {discounts.map((discount) => {
          const period = formatPromotionPeriod(discount)

          return (
            <article
              key={discount.id}
              className="rounded-[0.875rem] border border-success/16 bg-white/92 px-4 py-3.5"
            >
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <span
                  className="inline-flex items-center gap-1 rounded-full bg-[#dcfce7] px-2.5 py-1 text-[0.8125rem] font-extrabold whitespace-nowrap text-[#166534] [&_svg]:size-3.5"
                  aria-hidden="true"
                >
                  <Percent strokeWidth={2} />
                  −{discount.discountPercent}%
                </span>
                <h3 className="m-0 text-[0.9375rem] font-bold leading-snug text-foreground">
                  {discount.title}
                </h3>
              </div>

              {discount.description && (
                <p className="mt-2 text-sm leading-snug text-foreground">{discount.description}</p>
              )}

              <p className="mt-2 text-[0.8125rem] leading-snug text-muted">{discount.scope}</p>

              {period && <p className="mt-1.5 text-xs leading-snug text-[#15803d]">{period}</p>}
            </article>
          )
        })}
      </div>
    </section>
  )
}
