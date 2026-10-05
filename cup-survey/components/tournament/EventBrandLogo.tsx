import Image from 'next/image'
import { withBasePath } from '@/lib/basePath'
import { cn } from '@/lib/cn'

const sizes = {
  sm: 'h-8 w-auto',
  md: 'h-11 w-auto',
  lg: 'h-16 w-auto sm:h-20',
} as const

interface Props {
  size?: keyof typeof sizes
  className?: string
  priority?: boolean
}

export function EventBrandLogo({ size = 'md', className, priority }: Props) {
  return (
    <Image
      src={withBasePath('/images/fse-federation.png')}
      alt="Федерация смешанных единоборств"
      width={160}
      height={64}
      className={cn('shrink-0 object-contain', sizes[size], className)}
      priority={priority}
    />
  )
}
