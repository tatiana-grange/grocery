import type { ReactElement, ReactNode } from 'react'

interface BackOfficeFigureCardProps {
  label: ReactNode
  value: ReactNode
  testId?: string
}

/** A small card that shows one number the page already has, with its label. */
export function BackOfficeFigureCard({
  label,
  value,
  testId,
}: BackOfficeFigureCardProps): ReactElement {
  return (
    <div
      className="min-w-36 rounded-xl border-2 border-border bg-card px-4 py-3"
      data-testid={testId}
    >
      <div className="text-sm font-semibold text-muted-foreground">{label}</div>
      <div className="font-serif text-2xl font-bold tabular-nums">{value}</div>
    </div>
  )
}
