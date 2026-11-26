import type { ReactElement } from 'react'
import { formatCount } from './_components/format-count'
import { EmailLayout, EmailParagraph, type EmailBrand } from './_components/email-layout'
import { emailSamples, PREVIEW_BRAND } from './email-samples'

export interface SupplierOrderAutoSentEmailData {
  supplierName: string
  /** The distribution day, as French text. */
  distributionDay: string
  lineCount: number
  orderCount: number
}

/** The mail to each admin after an automatic run sent orders. */
export default function SupplierOrderAutoSent({
  brand,
  supplierName,
  distributionDay,
  lineCount,
  orderCount,
}: { brand: EmailBrand } & SupplierOrderAutoSentEmailData): ReactElement {
  return (
    <EmailLayout brand={brand} preview={`Commande envoyée automatiquement : ${supplierName}`}>
      <EmailParagraph>
        {`La commande de ${supplierName} pour la distribution du ${distributionDay} est partie par e-mail : ${formatCount({ count: lineCount, one: 'ligne', many: 'lignes' })} dans ${formatCount({ count: orderCount, one: 'commande', many: 'commandes' })}.`}
      </EmailParagraph>
    </EmailLayout>
  )
}

SupplierOrderAutoSent.PreviewProps = {
  brand: PREVIEW_BRAND,
  ...emailSamples.supplierOrderAutoSent,
}
