import { EmailLayout, EmailParagraph, type EmailBrand } from './_components/email-layout'
import { emailSamples, PREVIEW_BRAND } from './email-samples'

export interface SupplierOrderAutoSentEmailData {
  supplierName: string
  /** The distribution day, as French text. */
  distributionDay: string
  lineCount: number
  orderCount: number
}

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`
}

export default function SupplierOrderAutoSent({
  brand,
  supplierName,
  distributionDay,
  lineCount,
  orderCount,
}: { brand: EmailBrand } & SupplierOrderAutoSentEmailData) {
  return (
    <EmailLayout brand={brand} preview={`Commande envoyée automatiquement : ${supplierName}`}>
      <EmailParagraph>
        {`La commande de ${supplierName} pour la distribution du ${distributionDay} est partie par e-mail : ${plural(lineCount, 'ligne', 'lignes')} dans ${plural(orderCount, 'commande', 'commandes')}.`}
      </EmailParagraph>
    </EmailLayout>
  )
}

SupplierOrderAutoSent.PreviewProps = {
  brand: PREVIEW_BRAND,
  ...emailSamples.supplierOrderAutoSent,
}
