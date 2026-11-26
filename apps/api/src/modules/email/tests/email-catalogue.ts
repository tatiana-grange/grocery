import { renderEmailVerificationEmail, renderPasswordResetEmail } from '../email-templates'
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
]
