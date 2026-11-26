import type { ReactElement } from 'react'
import { EmailLayout, EmailParagraph, type EmailBrand } from './_components/email-layout'
import { emailSamples, PREVIEW_BRAND } from './email-samples'

export interface MembershipReactivatedEmailData {
  name: string
}

/** The mail to a member whose membership is active again. */
export default function MembershipReactivated({
  brand,
  name,
}: { brand: EmailBrand } & MembershipReactivatedEmailData): ReactElement {
  return (
    <EmailLayout brand={brand} preview="Votre adhésion est de nouveau active">
      <EmailParagraph>Bonjour {name},</EmailParagraph>
      <EmailParagraph>
        Votre adhésion à {brand.cooperativeName} est de nouveau active. Vous pouvez vous connecter à
        nouveau.
      </EmailParagraph>
    </EmailLayout>
  )
}

MembershipReactivated.PreviewProps = {
  brand: PREVIEW_BRAND,
  ...emailSamples.membershipReactivated,
}
