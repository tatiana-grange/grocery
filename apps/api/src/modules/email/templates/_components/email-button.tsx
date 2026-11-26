import { Link } from 'react-email'
import type { ReactElement, ReactNode } from 'react'
import { emailTheme } from './email-theme'

/** A link styled as the primary button. */
export function EmailButton({
  href,
  children,
}: {
  href: string
  children: ReactNode
}): ReactElement {
  return (
    <Link
      href={href}
      style={{
        display: 'inline-block',
        backgroundColor: emailTheme.primary,
        color: '#ffffff',
        fontFamily: emailTheme.sans,
        fontSize: '16px',
        fontWeight: 600,
        textDecoration: 'none',
        padding: '12px 24px',
        borderRadius: '6px',
      }}
    >
      {children}
    </Link>
  )
}
