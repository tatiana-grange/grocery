import * as React from 'react'

import { cn } from '@grocery/ui/lib/utils'

/**
 * A styled native `<select>`. Use it for short, static option lists where the platform
 * dropdown is enough; reach for `Select` / `Combobox` when the options are searchable,
 * rich, or come from a query.
 */
function NativeSelect({ className, ...props }: React.ComponentProps<'select'>) {
  return (
    <select
      data-slot="native-select"
      className={cn(
        'h-9 rounded-md border border-input bg-background px-3 text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20',
        className,
      )}
      {...props}
    />
  )
}

export { NativeSelect }
