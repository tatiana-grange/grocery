import type { ComponentProps, ReactElement } from 'react'

import { Badge } from '@grocery/ui/components/primitives/badge'
import { cn } from '@grocery/ui/lib/utils'

export type StatusTone = 'attention' | 'positive' | 'negative' | 'neutral'

const TONES: Record<
  StatusTone,
  { variant: 'default' | 'destructive' | 'outline'; className?: string }
> = {
  attention: { variant: 'outline', className: 'bg-straw text-straw-foreground' },
  positive: { variant: 'default' },
  negative: { variant: 'destructive' },
  neutral: { variant: 'outline' },
}

interface BackOfficeStatusBadgeProps extends Omit<ComponentProps<typeof Badge>, 'variant'> {
  tone: StatusTone
}

/** A status written as a word, in one of four theme tones. Never a colour alone. */
export function BackOfficeStatusBadge({
  tone,
  className,
  children,
  ...badgeProps
}: BackOfficeStatusBadgeProps): ReactElement {
  const { variant, className: toneClassName } = TONES[tone]
  return (
    <Badge variant={variant} className={cn(toneClassName, className)} {...badgeProps}>
      {children}
    </Badge>
  )
}
