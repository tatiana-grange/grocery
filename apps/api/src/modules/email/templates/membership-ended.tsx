import { EmailLayout, EmailParagraph, type EmailBrand } from './_components/email-layout'
import { emailSamples, PREVIEW_BRAND } from './email-samples'

export interface MembershipEndedEmailData {
  name: string
  /** Why, typed by an admin. Shown only when given. */
  reason?: string
}

export default function MembershipEnded({
  brand,
  name,
  reason,
}: { brand: EmailBrand } & MembershipEndedEmailData) {
  return (
    <EmailLayout brand={brand} preview="Votre adhésion a pris fin">
      <EmailParagraph>Bonjour {name},</EmailParagraph>
      <EmailParagraph>Votre adhésion à {brand.cooperativeName} a pris fin.</EmailParagraph>
      {reason ? <EmailParagraph>Motif : {reason}</EmailParagraph> : null}
    </EmailLayout>
  )
}

MembershipEnded.PreviewProps = {
  brand: PREVIEW_BRAND,
  ...emailSamples.membershipEnded,
}
