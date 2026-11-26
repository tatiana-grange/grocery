import { EmailLayout, EmailParagraph, type EmailBrand } from './_components/email-layout'
import { emailSamples, PREVIEW_BRAND } from './email-samples'

export interface MissedDistributionEmailData {
  supplierName: string
  /** The distribution day, as French text. */
  distributionDay: string
}

export default function MissedDistribution({
  brand,
  supplierName,
  distributionDay,
}: { brand: EmailBrand } & MissedDistributionEmailData) {
  return (
    <EmailLayout brand={brand} preview={`Distribution sans commande envoyée : ${supplierName}`}>
      <EmailParagraph>
        {`La distribution du ${distributionDay} de ${supplierName} a commencé sans que la commande soit partie.`}
      </EmailParagraph>
      <EmailParagraph>
        Rien n&apos;a été envoyé pour cette distribution. Il faut passer la commande au fournisseur
        à la main.
      </EmailParagraph>
    </EmailLayout>
  )
}

MissedDistribution.PreviewProps = {
  brand: PREVIEW_BRAND,
  ...emailSamples.missedDistribution,
}
