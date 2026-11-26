import { EmailLayout, EmailParagraph, type EmailBrand } from './_components/email-layout'
import { emailSamples, PREVIEW_BRAND } from './email-samples'

export interface NegativeBalanceMemberEmailData {
  name: string
}

/** No amount and no cause here: the member only learns that purchases are paused. */
export default function NegativeBalanceMember({
  brand,
  name,
}: { brand: EmailBrand } & NegativeBalanceMemberEmailData) {
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
