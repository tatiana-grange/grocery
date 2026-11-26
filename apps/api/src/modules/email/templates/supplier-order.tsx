import type { ReactElement } from 'react'
import { emailTheme } from './_components/email-theme'
import { formatCount } from './_components/format-count'
import { EmailLayout, EmailParagraph, type EmailBrand } from './_components/email-layout'
import { emailSamples, PREVIEW_BRAND } from './email-samples'

export interface SupplierOrderEmailData {
  supplierName: string
  /** The day of the order, as French text. */
  orderDay: string
  lines: { productName: string; quantity: number; unit: string }[]
}

/** The order to a supplier. The CSV is attached by the caller. */
export default function SupplierOrder({
  brand,
  supplierName,
  orderDay,
  lines,
}: { brand: EmailBrand } & SupplierOrderEmailData): ReactElement {
  return (
    <EmailLayout brand={brand} preview={`Commande de ${brand.cooperativeName} — ${supplierName}`}>
      <EmailParagraph>Bonjour,</EmailParagraph>
      <EmailParagraph>
        {`Voici la commande de ${brand.cooperativeName} du ${orderDay} (${formatCount({ count: lines.length, one: 'ligne', many: 'lignes' })}).`}
      </EmailParagraph>
      <ul
        style={{
          margin: '0 0 16px',
          paddingLeft: '20px',
          fontFamily: emailTheme.sans,
          fontSize: '16px',
          lineHeight: '24px',
          color: emailTheme.text,
        }}
      >
        {lines.map((line, index) => (
          <li key={index}>{`${line.productName} : ${line.quantity} ${line.unit}`}</li>
        ))}
      </ul>
      <EmailParagraph>Le détail est aussi dans le fichier CSV joint.</EmailParagraph>
      <EmailParagraph>Merci et bonne journée.</EmailParagraph>
    </EmailLayout>
  )
}

SupplierOrder.PreviewProps = {
  brand: { ...PREVIEW_BRAND, logoSrc: null },
  ...emailSamples.supplierOrder,
}
