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
}
