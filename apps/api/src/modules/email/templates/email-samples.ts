import type { EmailBrand } from './_components/email-layout'

/** The brand the preview uses. The preview serves `templates/static/` at `/static/`. */
export const PREVIEW_BRAND: EmailBrand = {
  cooperativeName: "Lay'picerie",
  logoSrc: '/static/logo.jpg',
}

/** Sample data of every template, for the preview and for the tests. */
export const emailSamples = {
  emailVerification: {
    name: 'Mia Dupont',
    url: 'https://app.example.org/verify-email?token=sample-token',
  },
  passwordReset: {
    name: 'Mia Dupont',
    url: 'https://app.example.org/reset-password?token=sample-token',
  },
  membershipApproved: { name: 'Mia Dupont' },
  membershipRejected: { name: 'Mia Dupont', reason: 'Dossier incomplet' },
  membershipEnded: { name: 'Mia Dupont', reason: 'Cotisation non renouvelée' },
  membershipReactivated: { name: 'Mia Dupont' },
  negativeBalanceMember: { name: 'Mia Dupont' },
  negativeBalanceAdmin: { memberName: 'Mia Dupont', membershipNumber: '42', balanceCents: -500 },
  underpaidTopupAdmin: {
    memberName: 'Mia Dupont',
    membershipNumber: '42',
    requestedCents: 2000,
    paidCents: 1500,
    topupId: 'topup-42',
  },
  supplierOrder: {
    supplierName: 'Moulin Dupont',
    orderDay: '2 décembre 2026',
    lines: [
      { productName: 'Farine T65', quantity: 10, unit: 'kg' },
      { productName: 'Œufs', quantity: 6, unit: 'pièces' },
      { productName: 'Miel', quantity: 1, unit: 'pièce' },
    ],
  },
  supplierOrderAutoSent: {
    supplierName: 'Moulin Dupont',
    distributionDay: '4 décembre 2026',
    lineCount: 7,
    orderCount: 2,
  },
  supplierOrderSendFailed: {
    supplierName: 'Moulin Dupont',
    orderId: 'order-42',
    orderDay: '2 décembre 2026',
    mode: 'automatic' as const,
    reason: 'no_address' as const,
    orderUrl: 'https://app.example.org/admin/purchasing/supplier-orders/order-42',
  },
  missedDistribution: { supplierName: 'Moulin Dupont', distributionDay: '4 décembre 2026' },
}
