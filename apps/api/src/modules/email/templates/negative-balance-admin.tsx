import type { ReactElement } from 'react'
import { formatEuros } from './_components/format-euros'
import { EmailLayout, EmailParagraph, type EmailBrand } from './_components/email-layout'
import { emailSamples, PREVIEW_BRAND } from './email-samples'

export interface NegativeBalanceAdminEmailData {
  memberName: string
  membershipNumber: string
  balanceCents: number
}

/** The mail to each admin about a member whose account is below zero. */
export default function NegativeBalanceAdmin({
  brand,
  memberName,
  membershipNumber,
  balanceCents,
}: { brand: EmailBrand } & NegativeBalanceAdminEmailData): ReactElement {
  return (
    <EmailLayout brand={brand} preview={`Solde négatif : ${memberName}`}>
      <EmailParagraph>
        {`${memberName} (adhérent n° ${membershipNumber}) a un solde négatif : ${formatEuros(balanceCents)}.`}
      </EmailParagraph>
    </EmailLayout>
  )
}

NegativeBalanceAdmin.PreviewProps = {
  brand: PREVIEW_BRAND,
  ...emailSamples.negativeBalanceAdmin,
}
