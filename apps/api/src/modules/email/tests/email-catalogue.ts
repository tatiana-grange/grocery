import {
  renderEmailVerificationEmail,
  renderMembershipApprovedEmail,
  renderMembershipEndedEmail,
  renderMembershipReactivatedEmail,
  renderMembershipRejectedEmail,
  renderNegativeBalanceAdminEmail,
  renderNegativeBalanceMemberEmail,
  renderMissedDistributionEmail,
  renderPasswordResetEmail,
  renderSupplierOrderAutoSentEmail,
  renderSupplierOrderEmail,
  renderSupplierOrderSendFailedEmail,
  renderUnderpaidTopupAdminEmail,
} from '../email-templates'
import type { RenderedEmail } from '../email-render'
import { emailSamples } from '../templates/email-samples'

export interface EmailCatalogueEntry {
  /** The template's file name, without `.tsx`. The test checks it against the folder. */
  name: string
  /** Renders the template with its sample data, as the real service does. */
  render: () => Promise<RenderedEmail>
  /** Whether the HTML carries the inline logo. */
  carriesLogo: boolean
  /** Addresses that must appear in the HTML and in the text. */
  links: string[]
}

/** Every template with its sample render. A new `.tsx` in `templates/` needs an entry here. */
export const EMAIL_CATALOGUE: EmailCatalogueEntry[] = [
  {
    name: 'email-verification',
    render: () => renderEmailVerificationEmail(emailSamples.emailVerification),
    carriesLogo: true,
    links: [emailSamples.emailVerification.url],
  },
  {
    name: 'password-reset',
    render: () => renderPasswordResetEmail(emailSamples.passwordReset),
    carriesLogo: true,
    links: [emailSamples.passwordReset.url],
  },
  {
    name: 'membership-approved',
    render: () => renderMembershipApprovedEmail(emailSamples.membershipApproved),
    carriesLogo: true,
    links: [],
  },
  {
    name: 'membership-rejected',
    render: () => renderMembershipRejectedEmail(emailSamples.membershipRejected),
    carriesLogo: true,
    links: [],
  },
  {
    name: 'membership-ended',
    render: () => renderMembershipEndedEmail(emailSamples.membershipEnded),
    carriesLogo: true,
    links: [],
  },
  {
    name: 'membership-reactivated',
    render: () => renderMembershipReactivatedEmail(emailSamples.membershipReactivated),
    carriesLogo: true,
    links: [],
  },
  {
    name: 'negative-balance-member',
    render: () => renderNegativeBalanceMemberEmail(emailSamples.negativeBalanceMember),
    carriesLogo: true,
    links: [],
  },
  {
    name: 'negative-balance-admin',
    render: () => renderNegativeBalanceAdminEmail(emailSamples.negativeBalanceAdmin),
    carriesLogo: true,
    links: [],
  },
  {
    name: 'underpaid-topup-admin',
    render: () => renderUnderpaidTopupAdminEmail(emailSamples.underpaidTopupAdmin),
    carriesLogo: true,
    links: [],
  },
  {
    name: 'supplier-order',
    render: () => renderSupplierOrderEmail(emailSamples.supplierOrder),
    carriesLogo: false,
    links: [],
  },
  {
    name: 'supplier-order-auto-sent',
    render: () => renderSupplierOrderAutoSentEmail(emailSamples.supplierOrderAutoSent),
    carriesLogo: true,
    links: [],
  },
  {
    name: 'supplier-order-send-failed',
    render: () => renderSupplierOrderSendFailedEmail(emailSamples.supplierOrderSendFailed),
    carriesLogo: true,
    links: [emailSamples.supplierOrderSendFailed.orderUrl],
  },
  {
    name: 'missed-distribution',
    render: () => renderMissedDistributionEmail(emailSamples.missedDistribution),
    carriesLogo: true,
    links: [],
  },
]
