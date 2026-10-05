import { cn } from '@/lib/cn'

export function ModalSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="flex min-h-48 flex-col gap-3" aria-hidden="true">
      {Array.from({ length: rows }, (_, index) => (
        <div
          key={index}
          className={cn(
            'h-14 rounded-xl bg-[linear-gradient(90deg,rgb(241_245_249/0.9)_0%,rgb(248_250_252/1)_45%,rgb(241_245_249/0.9)_100%)] bg-[length:200%_100%] animate-[app-modal-shimmer_1.2s_ease-in-out_infinite]',
            index === 1 && 'h-[5.5rem]',
            index === 2 && 'h-16',
          )}
        />
      ))}
    </div>
  )
}
