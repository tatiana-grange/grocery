import { EmailButton } from './_components/email-button'
import {
  EmailLayout,
  EmailLinkFallback,
  EmailParagraph,
  type EmailBrand,
} from './_components/email-layout'
import { emailSamples, PREVIEW_BRAND } from './email-samples'

export interface EmailVerificationEmailData {
  name: string
  url: string
}

export default function EmailVerification({
  brand,
  name,
  url,
}: { brand: EmailBrand } & EmailVerificationEmailData) {
  return (
    <EmailLayout brand={brand} preview="Confirmez votre adresse e-mail">
      <EmailParagraph>Bonjour {name},</EmailParagraph>
      <EmailParagraph>
        Pour confirmer votre adresse e-mail, cliquez sur le bouton ci-dessous.
      </EmailParagraph>
      <EmailButton href={url}>Confirmer mon adresse</EmailButton>
      <EmailLinkFallback url={url} />
      <EmailParagraph>Si vous n&apos;avez pas créé de compte, ignorez ce message.</EmailParagraph>
    </EmailLayout>
  )
}

EmailVerification.PreviewProps = {
  brand: PREVIEW_BRAND,
  ...emailSamples.emailVerification,
}
