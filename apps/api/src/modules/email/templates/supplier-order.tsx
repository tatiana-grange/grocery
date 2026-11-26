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
}: { brand: EmailBrand } & SupplierOrderEmailData) {
  return (
    <EmailLayout brand={brand} preview={`Commande de ${brand.cooperativeName} — ${supplierName}`}>
      <EmailParagraph>Bonjour,</EmailParagraph>
      <EmailParagraph>
        {`Voici la commande de ${brand.cooperativeName} du ${orderDay} (${lines.length} ${lines.length === 1 ? 'ligne' : 'lignes'}).`}
      </EmailParagraph>
      <ul style={{ margin: '0 0 16px', paddingLeft: '20px' }}>
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
  // Like the real mail, this one has no logo: its CSV stays the only attachment.
  brand: { ...PREVIEW_BRAND, logoSrc: null },
  ...emailSamples.supplierOrder,
}
