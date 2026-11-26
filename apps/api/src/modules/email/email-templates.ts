import { createElement } from 'react'
import { config } from '../../config/env.config'
import { EMAIL_LOGO_SRC } from './email-logo'
import { renderEmail, type RenderedEmail } from './email-render'
import type { EmailBrand } from './templates/_components/email-layout'
import EmailVerification, { type EmailVerificationEmailData } from './templates/email-verification'
import MembershipApproved, {
  type MembershipApprovedEmailData,
} from './templates/membership-approved'
import MembershipEnded, { type MembershipEndedEmailData } from './templates/membership-ended'
import MembershipReactivated, {
  type MembershipReactivatedEmailData,
} from './templates/membership-reactivated'
import MembershipRejected, {
  type MembershipRejectedEmailData,
} from './templates/membership-rejected'
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

export function renderMembershipApprovedEmail(
  data: MembershipApprovedEmailData,
): Promise<RenderedEmail> {
  return renderEmail({
    subject: 'Votre adhésion est confirmée',
    element: createElement(MembershipApproved, { brand: brand(), ...data }),
  })
}

export function renderMembershipRejectedEmail(
  data: MembershipRejectedEmailData,
): Promise<RenderedEmail> {
  return renderEmail({
    subject: "Votre demande d'adhésion",
    element: createElement(MembershipRejected, { brand: brand(), ...data }),
  })
}

export function renderMembershipEndedEmail(data: MembershipEndedEmailData): Promise<RenderedEmail> {
  return renderEmail({
    subject: 'Votre adhésion a pris fin',
    element: createElement(MembershipEnded, { brand: brand(), ...data }),
  })
}

export function renderMembershipReactivatedEmail(
  data: MembershipReactivatedEmailData,
): Promise<RenderedEmail> {
  return renderEmail({
    subject: 'Votre adhésion est de nouveau active',
    element: createElement(MembershipReactivated, { brand: brand(), ...data }),
  })
}
