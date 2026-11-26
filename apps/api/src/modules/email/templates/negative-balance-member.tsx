import type { ReactElement } from 'react'
import { EmailLayout, EmailParagraph, type EmailBrand } from './_components/email-layout'
import { emailSamples, PREVIEW_BRAND } from './email-samples'

export interface NegativeBalanceMemberEmailData {
  name: string
}

/** The mail to a member whose account is below zero. It holds no amount. */
export default function NegativeBalanceMember({
  brand,
  name,
}: { brand: EmailBrand } & NegativeBalanceMemberEmailData): ReactElement {
  return (
    <EmailLayout brand={brand} preview="Un problème sur votre compte">
      <EmailParagraph>Bonjour {name},</EmailParagraph>
      <EmailParagraph>Il y a un problème sur votre compte.</EmailParagraph>
      <EmailParagraph>
        Vos achats sont suspendus pour le moment. Vous pouvez recharger votre compte ou contacter la
        coopérative.
      </EmailParagraph>
    </EmailLayout>
  )
}

NegativeBalanceMember.PreviewProps = {
  brand: PREVIEW_BRAND,
  ...emailSamples.negativeBalanceMember,
}
