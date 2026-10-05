import { cn } from '@/lib/cn'
import type { StatusBadgeTone } from '@/components/ui/StatusBadge'

/** Public tournament shell — layout, page container, cards. */
export const eventShellLayout = cn(
  'flex min-h-screen flex-col bg-surface text-base leading-[1.55] text-foreground',
  'max-sm:overflow-x-clip has-[.event-brackets-page]:max-sm:overflow-x-visible',
)

export const eventShellHeader = cn(
  'event-header sticky top-0 z-50 border-b border-border bg-white shadow-sm',
  'pt-[env(safe-area-inset-top,0px)]',
)

export const eventShellContainer = 'mx-auto w-full max-w-6xl px-3 sm:px-6'

export const eventShellMain = 'flex-1 py-3 pb-4 sm:py-6 sm:pb-8'

export const eventShellHeaderMobileBar = 'flex items-center gap-3 py-2.5 sm:py-3 lg:hidden'

export const eventShellHeaderNavSection = 'hidden pb-2.5 pt-2.5 sm:pt-3 lg:block'

export const eventShellHeaderBrandRow = 'flex items-start justify-between gap-3'

export const eventShellHeaderBrandTitle = 'text-sm font-bold text-foreground sm:text-[15px]'

export const eventShellHeaderBrandSubtitle = 'mt-0.5 text-xs text-muted'

export const eventShellHeaderBrandLink =
  'flex min-w-0 items-center gap-2.5 sm:gap-3 transition-opacity hover:opacity-90'

export const eventShellHeaderNavRow = 'mt-2 flex flex-wrap items-center gap-0.5'

export const eventPage = 'w-full'

export const eventCard =
  'rounded-card border border-border bg-card shadow-[0_1px_2px_rgb(15_20_25/0.03)]'

export function eventShellNavLink(active: boolean) {
  return cn(
    'relative px-3.5 py-2 text-[0.9375rem] font-semibold text-muted transition-colors hover:text-foreground',
    active && 'text-accent after:absolute after:bottom-0.5 after:left-3.5 after:right-3.5 after:h-0.5 after:rounded-full after:bg-accent',
  )
}

export function eventBurgerButton(open: boolean) {
  return cn(
    'flex size-11 shrink-0 flex-col items-center justify-center gap-[0.3125rem] rounded-lg border border-border bg-card text-foreground transition-[border-color,background-color] [-webkit-tap-highlight-color:transparent] hover:border-accent/25 lg:hidden',
    open && 'border-accent bg-accent-soft',
  )
}

export function eventBurgerLine(open: boolean, index: 1 | 2 | 3) {
  return cn(
    'block h-0.5 rounded-full bg-current transition-[transform,opacity,width]',
    index === 1 && 'w-[1.125rem]',
    index === 2 && 'w-[1.125rem]',
    index === 3 && 'w-[1.125rem]',
    open && index === 1 && 'translate-y-[7px] rotate-45',
    open && index === 2 && 'w-0 opacity-0',
    open && index === 3 && '-translate-y-[7px] -rotate-45',
  )
}

export const eventFooterContacts = cn(
  'flex flex-wrap items-center gap-x-2 gap-y-1 leading-[1.45]',
  'max-sm:flex-col max-sm:items-start max-sm:gap-1.5',
)

export const eventFooterContactSep = 'text-muted opacity-65 max-sm:hidden'

export function eventMobileMenuRoot(visible: boolean) {
  return cn(
    'event-mobile-menu fixed inset-0 z-[var(--z-modal-nested)] transition-[opacity,visibility] duration-[220ms] ease-out lg:hidden',
    visible && 'is-open',
    visible ? 'visible opacity-100' : 'invisible opacity-0',
  )
}

export function eventMobileMenuBackdrop(visible: boolean) {
  return cn(
    'event-mobile-menu-backdrop absolute inset-0 border-0 bg-foreground/45 backdrop-blur-[2px] transition-opacity duration-[220ms] ease-out',
    visible ? 'opacity-100' : 'opacity-0',
  )
}

export function eventMobileMenuPanel(visible: boolean) {
  return cn(
    'event-mobile-menu-panel absolute inset-y-0 right-0 flex w-full max-w-80 flex-col border-l border-border bg-card shadow-[-8px_0_32px_rgb(15_20_25/0.12)] transition-transform duration-[280ms] ease-[cubic-bezier(0.22,1,0.36,1)]',
    'pt-[calc(0.75rem+env(safe-area-inset-top,0px))] px-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))]',
    visible ? 'translate-x-0' : 'translate-x-full',
  )
}

export const eventMobileMenuTitle = 'text-base font-extrabold text-foreground'

export const eventMobileMenuClose =
  'inline-flex size-10 items-center justify-center rounded-lg border border-border bg-card text-muted [&_svg]:size-5'

export const eventMobileMenuNav = 'flex flex-col gap-1.5'

export function eventMobileMenuLink(active: boolean) {
  return cn(
    'flex min-h-12 items-center justify-between rounded-lg px-4 py-3 text-base font-semibold text-foreground transition-[background-color,color] hover:bg-surface',
    active && 'bg-accent-soft text-accent',
  )
}

export const eventMobileMenuBadge =
  'inline-flex min-w-[1.375rem] items-center justify-center rounded-full bg-accent px-[0.4375rem] py-0.5 text-xs font-bold text-card'

export function eventMobileMenuCta(active: boolean) {
  return cn('mt-4 block', active && '[&_.btn]:shadow-[0_0_0_2px_var(--color-accent-soft),0_0_0_3px_var(--color-accent)]')
}

/** Landing page schedule timeline. */
export const eventTimeline = 'm-0 list-none p-0'

export const eventTimelineItem =
  'relative grid grid-cols-[1.25rem_minmax(0,1fr)] gap-x-4 gap-y-0 pb-5 last:pb-0'

export const eventTimelineMarker =
  'mt-1.5 ml-1 size-3 rounded-full bg-accent shadow-[0_0_0_4px_var(--color-accent-soft)]'

export const eventTimelineLine =
  'absolute bottom-0 left-2.5 top-5 w-0.5 bg-border'

export const eventTimelineTime = 'text-xl font-extrabold text-foreground'

export const eventTimelineLabel = 'mt-1.5 text-base text-muted'

/** Landing page FAQ accordion. */
export const eventFaqList = 'flex flex-col'

export const eventFaqItem = 'event-faq-item group/faq border-b border-border first:border-t'

export const eventFaqQuestion = cn(
  'flex cursor-pointer list-none items-center justify-between gap-4 py-4 text-base font-semibold text-foreground [&::-webkit-details-marker]:hidden',
)

export const eventFaqIcon =
  'text-xl text-muted transition-transform duration-[280ms] ease-[cubic-bezier(0.22,1,0.36,1)] group-open/faq:rotate-45'

export const eventFaqAnswerWrap = cn(
  'event-faq-answer-wrap grid grid-rows-[0fr] transition-[grid-template-rows] duration-[280ms] ease-[cubic-bezier(0.22,1,0.36,1)] group-open/faq:grid-rows-[1fr]',
)

export const eventFaqAnswerInner = 'min-h-0 overflow-hidden'

export const eventFaqAnswer = 'pb-4 text-[0.9375rem] leading-relaxed text-muted'

/** Registration unlock / edit gate. */
export const registrationUnlockForm = cn(eventCard, 'w-full max-w-md mx-auto p-5 sm:p-8')

export const registrationUnlockFormEmbedded =
  'w-full max-w-none border-0 bg-transparent p-0 shadow-none'

export const registrationUnlockFormTitle = 'text-[1.0625rem] font-bold text-foreground'

export const registrationUnlockFormDescription =
  'mt-2 text-sm leading-[1.55] text-muted'

export const registrationUnlockFormNumber = 'mt-4 text-sm font-semibold text-foreground'

export const registrationEditPage = 'w-full min-w-0'

export const registrationEditState =
  'px-4 py-12 text-center text-[0.9375rem] text-muted'

/** Compact payment-status pills (public registration lists). */
export const eventStatusBadgeBase =
  'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold leading-tight whitespace-nowrap'

const eventStatusBadgeToneClasses: Record<StatusBadgeTone, string> = {
  neutral: 'bg-bronze-soft text-bronze-foreground border border-bronze-border/22',
  success: 'bg-success-soft text-success',
  warning: 'bg-info-soft text-info',
  danger: 'bg-warning-soft text-warning-foreground border border-warning-border/35',
  info: 'bg-partner-indigo-soft text-violet-foreground border border-violet-border/18',
  amber: 'bg-info-soft text-info',
  violet: 'bg-partner-indigo-soft text-violet-foreground border border-violet-border/18',
  sky: 'bg-partner-indigo-soft text-violet-foreground border border-sky-border/18',
}

export function eventStatusBadgeClass(tone: StatusBadgeTone) {
  return cn(eventStatusBadgeBase, eventStatusBadgeToneClasses[tone])
}

/** Payment modal helpers shared with registration summary. */
export const paymentUi = {
  discountBanner: cn(
    'mb-3 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-success-border/90',
    'bg-gradient-to-br from-success-soft/95 to-success-soft/85 px-3.5 py-3',
  ),
  discountBadge: cn(
    'inline-flex min-h-6 items-center justify-center rounded-full bg-success/12 px-2 py-0.5',
    'text-xs font-extrabold tracking-wide text-success-foreground whitespace-nowrap',
  ),
  discountText: 'text-[0.8125rem] font-semibold text-success-foreground',

  copyChip: cn(
    'flex h-auto min-h-0 w-full min-w-0 flex-col items-stretch gap-1 rounded-[0.625rem] border border-border',
    'bg-surface p-2.5 text-left transition-[border-color,background-color,box-shadow]',
    'hover:border-accent/30 hover:bg-accent-soft focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_rgb(from_var(--color-accent)_r_g_b/0.18)]',
  ),
  copyChipHeader: 'flex items-start justify-between gap-2',
  copyChipLabel:
    'min-w-0 pt-0.5 text-[0.6875rem] font-bold uppercase tracking-wide text-muted',
  copyChipValue: cn(
    'block w-full min-w-0 break-words text-sm font-bold leading-snug text-foreground tabular-nums',
  ),
  copyChipValueSpaced: 'tracking-wide',
  copyChipAction: cn(
    'mt-[-0.125rem] inline-flex shrink-0 items-center gap-1 text-xs font-semibold leading-tight text-accent whitespace-nowrap',
    'transition-[background-color,color,transform]',
  ),
  copyChipActionCopied: cn(
    'rounded-full bg-accent px-2.5 py-1.5 font-bold text-card',
  ),
  copyChipCheck: 'size-3.5',

  uploadInput: 'sr-only',
  uploadLabel: 'block cursor-pointer',
  uploadTitle: 'mb-1.5 block text-[0.8125rem] font-bold text-foreground',
  uploadButton: cn(
    'flex min-h-12 items-center justify-center rounded-lg border-2 border-dashed border-accent/35',
    'bg-card px-4 py-3 text-center text-sm font-semibold leading-snug text-accent',
    'transition-[border-color,background-color] group-hover/upload:border-accent/55 group-hover/upload:bg-accent-soft',
    'group-focus-within/upload:border-accent/55 group-focus-within/upload:bg-accent-soft',
  ),

  sberQuick: cn(
    'rounded-lg border border-success/20 bg-gradient-to-b from-success-soft to-card p-3.5',
  ),
  sberQuickLabel: 'mb-3 text-[0.8125rem] font-bold text-success-foreground',
  sberQuickBody: 'flex flex-col items-stretch gap-3.5',
  sberQrWrap: 'flex shrink-0 flex-col items-center gap-1.5 self-center',
  sberQr: 'block size-40 rounded-lg border border-border bg-card',
  sberQrPlaceholder:
    'animate-[payment-qr-shimmer_1.2s_infinite_linear] bg-gradient-to-r from-neutral-soft via-neutral-border to-neutral-soft bg-[length:200%_100%]',
  sberQrCaption: 'm-0 text-center text-[0.6875rem] font-semibold text-muted',
  sberQuickActions: 'flex min-w-0 flex-col gap-2',
  sberOpen: cn(
    'flex min-h-11 w-full items-center justify-center rounded-[0.625rem] border-0 bg-sber px-4 py-2.5',
    'text-center text-sm font-bold leading-snug text-card no-underline transition-[background-color,transform]',
    'hover:bg-sber-hover active:scale-[0.98] [touch-action:manipulation] [-webkit-tap-highlight-color:transparent]',
  ),
} as const

const priceSizeClasses = {
  sm: { plain: 'font-bold', discountNew: 'font-bold' },
  md: { plain: 'font-bold text-foreground', discountNew: 'font-bold text-accent' },
  lg: { plain: 'text-[1.375rem] font-extrabold text-accent', discountNew: 'text-[1.375rem] font-extrabold text-accent' },
} as const

export function pricePlainClass(size: 'sm' | 'md' | 'lg' = 'md', className?: string) {
  return cn('inline-flex items-baseline gap-1.5 tabular-nums', priceSizeClasses[size].plain, className)
}

export function priceWithDiscountClass(
  size: 'sm' | 'md' | 'lg' = 'md',
  align: 'left' | 'right' = 'left',
  className?: string,
) {
  return cn(
    'inline-flex items-baseline gap-1.5 tabular-nums',
    align === 'right' && 'flex-col items-end gap-0.5',
    className,
  )
}

export function priceWithDiscountOldClass() {
  return 'text-muted line-through decoration-1'
}

export function priceWithDiscountNewClass(size: 'sm' | 'md' | 'lg' = 'md') {
  return priceSizeClasses[size].discountNew
}
