import type { ComponentProps, ReactNode } from 'react'

import { Button } from '@grocery/ui/components/primitives/button'
import { cn } from '@grocery/ui/lib/utils'

export interface SegmentedControlOption<T extends string> {
  value: T
  label: ReactNode
  testId?: string
  ariaLabel?: string
  disabled?: boolean
}

export interface SegmentedControlProps<T extends string> {
  options: ReadonlyArray<SegmentedControlOption<T>>
  /** A single value for single-select, or an array for multi-select. */
  value: T | ReadonlyArray<T>
  /** Fires with the clicked option. The caller decides how to fold it into `value`. */
  onChange: (value: T) => void
  size?: ComponentProps<typeof Button>['size']
  wrap?: boolean
  className?: string
  itemClassName?: string
  'data-testid'?: string
}

/**
 * A row of mutually-exclusive (or multi-select) choices rendered as toggle buttons — the
 * pattern this codebase reaches for when a full RadioGroup would be overkill (sale mode,
 * ordering mode, identifier mode, shop layout, …). The selected option gets the `default`
 * button variant, the rest get `outline`.
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  size = 'sm',
  wrap,
  className,
  itemClassName,
  ...props
}: SegmentedControlProps<T>) {
  const isSelected = (option: T): boolean =>
    Array.isArray(value) ? value.includes(option) : value === option

  return (
    <div
      role="group"
      data-testid={props['data-testid']}
      className={cn('flex gap-2', wrap && 'flex-wrap', className)}
    >
      {options.map((option) => (
        <Button
          key={option.value}
          type="button"
          size={size}
          variant={isSelected(option.value) ? 'default' : 'outline'}
          aria-pressed={isSelected(option.value)}
          aria-label={option.ariaLabel}
          disabled={option.disabled}
          data-testid={option.testId}
          className={itemClassName}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </Button>
      ))}
    </div>
  )
}
