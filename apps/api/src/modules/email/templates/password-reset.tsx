import type { ReactElement } from 'react'
import { EmailButton } from './_components/email-button'
import {
  EmailLayout,
  EmailLinkFallback,
  EmailParagraph,
  type EmailBrand,
} from './_components/email-layout'
import { emailSamples, PREVIEW_BRAND } from './email-samples'

export interface PasswordResetEmailData {
  name: string
  url: string
}

/** The mail that gives a user the link to choose a new password. */
export default function PasswordReset({
  brand,
  name,
  url,
}: { brand: EmailBrand } & PasswordResetEmailData): ReactElement {
  return (
    <EmailLayout brand={brand} preview="Réinitialisez votre mot de passe">
      <EmailParagraph>Bonjour {name},</EmailParagraph>
      <EmailParagraph>
        Vous avez demandé à changer votre mot de passe. Cliquez sur le bouton ci-dessous pour en
        choisir un nouveau.
      </EmailParagraph>
      <EmailButton href={url}>Choisir un nouveau mot de passe</EmailButton>
      <EmailLinkFallback url={url} />
      <EmailParagraph>
        Si vous n&apos;avez rien demandé, ignorez ce message : votre mot de passe reste le même.
      </EmailParagraph>
    </EmailLayout>
  )
}

PasswordReset.PreviewProps = {
  brand: PREVIEW_BRAND,
  ...emailSamples.passwordReset,
}
