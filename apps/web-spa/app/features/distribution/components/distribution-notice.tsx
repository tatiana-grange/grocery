import { cn } from '@grocery/ui/lib/utils'
import { AlertTriangle, CheckCircle2 } from 'lucide-react'
import type { ComponentProps, ReactElement } from 'react'

interface DistributionNoticeProps extends ComponentProps<'div'> {
  tone: 'warning' | 'success'
}

/** A boxed message of the table: a warning (squash border, light squash ground) or a success. */
export function DistributionNotice({
  tone,
  className,
  children,
  ...props
}: DistributionNoticeProps): ReactElement {
  const Icon = tone === 'warning' ? AlertTriangle : CheckCircle2
  return (
    <div
      className={cn(
        'flex items-start gap-3 rounded-xl border-2 p-4 text-base text-foreground',
        tone === 'warning' ? 'border-warning bg-warning/10' : 'border-primary bg-card',
        className,
      )}
      {...props}
    >
      <Icon className="size-6 shrink-0" aria-hidden="true" />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}
