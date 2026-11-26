import { EmailLayout, EmailParagraph, type EmailBrand } from './_components/email-layout'
import { emailSamples, PREVIEW_BRAND } from './email-samples'

export interface MembershipApprovedEmailData {
  name: string
}

export default function MembershipApproved({
  brand,
  name,
}: { brand: EmailBrand } & MembershipApprovedEmailData) {
  return (
    <EmailLayout brand={brand} preview="Votre adhésion est confirmée">
      <EmailParagraph>Bonjour {name},</EmailParagraph>
      <EmailParagraph>
        Votre adhésion à {brand.cooperativeName} est confirmée. Vous pouvez maintenant vous
        connecter.
      </EmailParagraph>
    </EmailLayout>
  )
}

MembershipApproved.PreviewProps = {
  brand: PREVIEW_BRAND,
  ...emailSamples.membershipApproved,
}
