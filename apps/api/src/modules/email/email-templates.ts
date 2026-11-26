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
import MissedDistribution, {
  type MissedDistributionEmailData,
} from './templates/missed-distribution'
import NegativeBalanceAdmin, {
  type NegativeBalanceAdminEmailData,
} from './templates/negative-balance-admin'
import NegativeBalanceMember, {
  type NegativeBalanceMemberEmailData,
} from './templates/negative-balance-member'
import PasswordReset, { type PasswordResetEmailData } from './templates/password-reset'
import SupplierOrder, { type SupplierOrderEmailData } from './templates/supplier-order'
import SupplierOrderAutoSent, {
  type SupplierOrderAutoSentEmailData,
} from './templates/supplier-order-auto-sent'
import SupplierOrderSendFailed, {
  type SupplierOrderSendFailedEmailData,
} from './templates/supplier-order-send-failed'
import UnderpaidTopupAdmin, {
  type UnderpaidTopupAdminEmailData,
} from './templates/underpaid-topup-admin'

// This file is `.ts`: JSX lives under `templates/` only (see the README), so it uses createElement.

/**
 * The brand of a real mail: the cooperative's name from the setting, and the inline logo unless
 * the mail leaves without it.
 */
function brand(options: { logo?: boolean } = {}): EmailBrand {
  return {
    cooperativeName: config.cooperative.name,
    logoSrc: options.logo === false ? null : EMAIL_LOGO_SRC,
  }
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

export function renderNegativeBalanceMemberEmail(
  data: NegativeBalanceMemberEmailData,
): Promise<RenderedEmail> {
  return renderEmail({
    subject: 'Un problème sur votre compte',
    element: createElement(NegativeBalanceMember, { brand: brand(), ...data }),
  })
}

export function renderNegativeBalanceAdminEmail(
  data: NegativeBalanceAdminEmailData,
): Promise<RenderedEmail> {
  return renderEmail({
    subject: `Solde négatif : ${data.memberName}`,
    element: createElement(NegativeBalanceAdmin, { brand: brand(), ...data }),
  })
}

export function renderUnderpaidTopupAdminEmail(
  data: UnderpaidTopupAdminEmailData,
): Promise<RenderedEmail> {
  return renderEmail({
    subject: `Paiement incomplet : ${data.memberName}`,
    element: createElement(UnderpaidTopupAdmin, { brand: brand(), ...data }),
  })
}

/** The order to the supplier leaves without the logo: its CSV stays the only attachment. */
export function renderSupplierOrderEmail(data: SupplierOrderEmailData): Promise<RenderedEmail> {
  return renderEmail({
    subject: `Commande de ${config.cooperative.name} — ${data.supplierName}`,
    element: createElement(SupplierOrder, { brand: brand({ logo: false }), ...data }),
  })
}

export function renderSupplierOrderAutoSentEmail(
  data: SupplierOrderAutoSentEmailData,
): Promise<RenderedEmail> {
  return renderEmail({
    subject: `Commande envoyée automatiquement : ${data.supplierName}`,
    element: createElement(SupplierOrderAutoSent, { brand: brand(), ...data }),
  })
}

export function renderSupplierOrderSendFailedEmail(
  data: SupplierOrderSendFailedEmailData,
): Promise<RenderedEmail> {
  return renderEmail({
    subject: `Commande non envoyée : ${data.supplierName}`,
    element: createElement(SupplierOrderSendFailed, { brand: brand(), ...data }),
  })
}

export function renderMissedDistributionEmail(
  data: MissedDistributionEmailData,
): Promise<RenderedEmail> {
  return renderEmail({
    subject: `Distribution sans commande envoyée : ${data.supplierName}`,
    element: createElement(MissedDistribution, { brand: brand(), ...data }),
  })
}
