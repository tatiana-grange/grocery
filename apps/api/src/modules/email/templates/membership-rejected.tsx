import type { ReactElement } from 'react'
import { EmailLayout, EmailParagraph, type EmailBrand } from './_components/email-layout'
import { emailSamples, PREVIEW_BRAND } from './email-samples'

export interface MembershipRejectedEmailData {
  name: string
  /** Why, typed by an admin. Shown only when given. */
  reason?: string
}

/** The mail to a person whose membership request was rejected, with the reason when given. */
export default function MembershipRejected({
  brand,
  name,
  reason,
}: { brand: EmailBrand } & MembershipRejectedEmailData): ReactElement {
  return (
    <EmailLayout brand={brand} preview="Votre demande d'adhésion">
      <EmailParagraph>Bonjour {name},</EmailParagraph>
      <EmailParagraph>
        Votre demande d&apos;adhésion à {brand.cooperativeName} n&apos;a pas été acceptée.
      </EmailParagraph>
      {reason ? <EmailParagraph>Motif : {reason}</EmailParagraph> : null}
    </EmailLayout>
  )
}

MembershipRejected.PreviewProps = {
  brand: PREVIEW_BRAND,
  ...emailSamples.membershipRejected,
}
