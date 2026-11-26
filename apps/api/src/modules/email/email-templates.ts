import { createElement } from 'react'
import { config } from '../../config/env.config'
import { EMAIL_LOGO_SRC } from './email-logo'
import { renderEmail, type RenderedEmail } from './email-render'
import type { EmailBrand } from './templates/_components/email-layout'
import EmailVerification, { type EmailVerificationEmailData } from './templates/email-verification'
import PasswordReset, { type PasswordResetEmailData } from './templates/password-reset'

// This file is `.ts`: JSX lives under `templates/` only (see the README), so it uses createElement.

/** The brand of a real mail: the cooperative's name from the setting, the inline logo. */
function brand(): EmailBrand {
  return { cooperativeName: config.cooperative.name, logoSrc: EMAIL_LOGO_SRC }
}

export function renderEmailVerificationEmail(
  data: EmailVerificationEmailData,
): Promise<RenderedEmail> {
  return renderEmail({
    subject: 'Confirmez votre adresse e-mail',
    element: createElement(EmailVerification, { brand: brand(), ...data }),
  })
}

export function renderPasswordResetEmail(data: PasswordResetEmailData): Promise<RenderedEmail> {
  return renderEmail({
    subject: 'Réinitialisez votre mot de passe',
    element: createElement(PasswordReset, { brand: brand(), ...data }),
  })
}
