import { Body, Container, Head, Heading, Hr, Html, Img, Preview, Section, Text } from 'react-email'
import type { ReactNode } from 'react'
import { emailTheme } from './email-theme'

export interface EmailBrand {
  cooperativeName: string
  /** Where the logo comes from. `null` shows the name alone. */
  logoSrc: string | null
}

const textStyle = {
  fontFamily: emailTheme.sans,
  fontSize: '16px',
  lineHeight: '24px',
  color: emailTheme.text,
} as const

/** The shared layout of every mail: logo and name, a white card for the body, a footer. */
export function EmailLayout({
  brand,
  preview,
  children,
}: {
  brand: EmailBrand
  preview: string
  children: ReactNode
}) {
  return (
    <Html lang="fr">
      <Head />
      <Preview>{preview}</Preview>
      <Body style={{ backgroundColor: emailTheme.page, margin: 0, padding: '24px 0' }}>
        <Container style={{ maxWidth: '560px', margin: '0 auto' }}>
          <Section
            style={{
              backgroundColor: emailTheme.accent,
              padding: '24px',
              textAlign: 'center',
              borderRadius: '8px 8px 0 0',
            }}
          >
            {brand.logoSrc ? (
              <Img
                src={brand.logoSrc}
                width="120"
                alt={brand.cooperativeName}
                style={{ margin: '0 auto 12px' }}
              />
            ) : null}
            <Heading
              as="h1"
              style={{
                fontFamily: emailTheme.serif,
                fontSize: '24px',
                color: emailTheme.text,
                margin: 0,
              }}
            >
              {brand.cooperativeName}
            </Heading>
          </Section>
          <Section
            style={{
              backgroundColor: emailTheme.card,
              padding: '24px',
              borderRadius: '0 0 8px 8px',
            }}
          >
            {children}
          </Section>
          <Hr style={{ borderColor: emailTheme.accent, margin: '24px 0 12px' }} />
          <Text
            style={{
              fontFamily: emailTheme.sans,
              fontSize: '12px',
              lineHeight: '18px',
              color: emailTheme.muted,
              textAlign: 'center',
              margin: 0,
            }}
          >
            Message envoyé automatiquement par l&apos;application de {brand.cooperativeName}.
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

/** A paragraph of the body, in the text font. */
export function EmailParagraph({ children }: { children: ReactNode }) {
  return <Text style={{ ...textStyle, margin: '0 0 16px' }}>{children}</Text>
}

/** Small muted text under a button, for the address of the link. */
export function EmailLinkFallback({ url }: { url: string }) {
  return (
    <Text style={{ ...textStyle, fontSize: '13px', color: emailTheme.muted, margin: '16px 0 0' }}>
      Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur : {url}
    </Text>
  )
}
