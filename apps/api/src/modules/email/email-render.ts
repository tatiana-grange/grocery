import { render } from '@react-email/render'
import type { ReactElement } from 'react'

export interface RenderedEmail {
  subject: string
  html: string
  text: string
}

/** Renders a template to HTML and to the plain text derived from that same HTML. */
export async function renderEmail(input: {
  subject: string
  element: ReactElement
}): Promise<RenderedEmail> {
  const [html, text] = await Promise.all([
    render(input.element),
    render(input.element, { plainText: true }),
  ])
  return { subject: input.subject, html, text }
}
