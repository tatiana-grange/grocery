import { QRCodeSVG } from 'qrcode.react'
import { useTranslation } from 'react-i18next'

/**
 * The member's personal QR code. Encodes only the opaque membership number — no PII —
 * so a distribution station (lot 4) can look the member up by scanning it.
 */
export function MemberQr({ membershipNumber }: { membershipNumber: string }) {
  const { t } = useTranslation()

  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border border-border p-6">
      <QRCodeSVG value={membershipNumber} size={160} className="rounded bg-white p-2" />
      <p className="font-mono text-sm">{membershipNumber}</p>
      <p className="text-xs text-muted-foreground">{t('members.account.qrHint')}</p>
    </div>
  )
}
