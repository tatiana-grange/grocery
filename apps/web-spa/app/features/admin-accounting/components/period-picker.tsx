import { Button } from '@grocery/ui/components/primitives/button'
import { Input } from '@grocery/ui/components/primitives/input'
import { useTranslation } from 'react-i18next'
import { type Period, yearPeriod } from '@/features/admin-accounting/hooks/use-period'

interface PeriodPickerProps {
  period: Period
  onChange: (period: Period) => void
}

/** Two days, both included, read in the cooperative's time zone by the server. */
export function PeriodPicker({ period, onChange }: PeriodPickerProps) {
  const { t } = useTranslation()

  // A half-typed or backwards pair is ignored: the screen keeps the last good period.
  const handleChange = (next: Period) => {
    if (next.from && next.to && next.from <= next.to) onChange(next)
  }

  return (
    <div className="flex flex-wrap items-end gap-3" data-testid="period-picker">
      <label className="flex flex-col gap-1 text-base font-semibold">
        <span>{t('adminAccounting.period.from')}</span>
        <Input
          type="date"
          className="w-44"
          data-testid="period-from"
          value={period.from}
          max={period.to}
          onChange={(event) => handleChange({ from: event.target.value, to: period.to })}
        />
      </label>
      <label className="flex flex-col gap-1 text-base font-semibold">
        <span>{t('adminAccounting.period.to')}</span>
        <Input
          type="date"
          className="w-44"
          data-testid="period-to"
          value={period.to}
          min={period.from}
          onChange={(event) => handleChange({ from: period.from, to: event.target.value })}
        />
      </label>
      <Button
        type="button"
        variant="outline"
        size="sm"
        data-testid="period-this-year"
        onClick={() => onChange(yearPeriod(new Date().getFullYear()))}
      >
        {t('adminAccounting.period.thisYear')}
      </Button>
    </div>
  )
}
