import { Button } from '@grocery/ui/components/primitives/button'
import type { ReactElement, ReactNode } from 'react'
import { Link } from 'react-router'

interface AuthTextLinkProps {
  to: string
  children: ReactNode
}

/**
 * The link under a sign-in form ("Create an account", "Back to sign-in"). A 48 px link button
 * whose long French label wraps on a phone instead of pushing the page sideways.
 */
export function AuthTextLink({ to, children }: AuthTextLinkProps): ReactElement {
  return (
    <Button
      variant="link"
      className="h-auto min-h-12 text-center whitespace-normal"
      render={<Link to={to} />}
    >
      {children}
    </Button>
  )
}
