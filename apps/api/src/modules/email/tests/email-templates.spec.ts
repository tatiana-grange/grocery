import { readdirSync } from 'node:fs'
import { join } from 'node:path'
import { EMAIL_CATALOGUE } from './email-catalogue'

const ENGLISH_WORDS = /\b(hello|your|please|reason)\b/i

function hrefsOf(html: string): string[] {
  return [...html.matchAll(/href="([^"]+)"/g)].map((match) => match[1].replaceAll('&amp;', '&'))
}

describe('e-mail templates', () => {
  it('lists the same templates as the templates folder', () => {
    const files = readdirSync(join(__dirname, '..', 'templates'))
      .filter((file) => file.endsWith('.tsx'))
      .map((file) => file.replace(/\.tsx$/, ''))
      .sort()

    expect(EMAIL_CATALOGUE.map((entry) => entry.name).sort()).toEqual(files)
  })

  describe.each(EMAIL_CATALOGUE)('$name', (entry) => {
    it('renders a subject, an HTML version and a text version', async () => {
      const mail = await entry.render()

      expect(mail.subject.length).toBeGreaterThan(0)
      expect(mail.html).toContain('<html')
      expect(mail.text.length).toBeGreaterThan(0)
    })

    it('holds no English word of the old mails', async () => {
      const mail = await entry.render()

      expect(mail.subject).not.toMatch(ENGLISH_WORDS)
      expect(mail.text).not.toMatch(ENGLISH_WORDS)
      expect(mail.html).not.toMatch(ENGLISH_WORDS)
    })

    it('has every link of the HTML in the text', async () => {
      const mail = await entry.render()

      for (const href of hrefsOf(mail.html)) {
        expect(mail.text).toContain(href)
      }
      for (const link of entry.links) {
        expect(mail.html).toContain(link)
        expect(mail.text).toContain(link)
      }
    })

    it('shows the logo in the HTML only, when the mail carries it', async () => {
      const mail = await entry.render()

      if (entry.carriesLogo) {
        expect(mail.html).toContain('cid:logo@grocery')
      } else {
        expect(mail.html).not.toContain('cid:')
      }
      expect(mail.text).not.toContain('cid:')
    })

    it('shows the cooperative name in the text', async () => {
      const mail = await entry.render()

      expect(mail.text).toContain("Lay'picerie")
    })
  })
})
