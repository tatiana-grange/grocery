import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { AwningBand } from './awning-band'

const css = readFileSync(new URL('../../styles/globals.css', import.meta.url), 'utf8')

/** The body of the first block that starts with `selector {`. */
function block(selector: string): string {
  const open = css.indexOf('{', css.indexOf(`${selector} {`))
  let depth = 0
  for (let i = open; i < css.length; i++) {
    if (css[i] === '{') depth++
    if (css[i] === '}') depth--
    if (depth === 0) return css.slice(open + 1, i)
  }
  throw new Error(`Unclosed ${selector} block`)
}

describe('AwningBand', () => {
  const html = renderToStaticMarkup(<AwningBand />)

  it('is hidden from assistive technology', () => {
    expect(html).toContain('aria-hidden="true"')
  })

  it('carries its data-slot and the awning class', () => {
    expect(html).toContain('data-slot="awning-band"')
    expect(html).toMatch(/class="[^"]*\bawning\b/)
  })

  it('keeps a className passed by the caller', () => {
    expect(renderToStaticMarkup(<AwningBand className="mb-4" />)).toMatch(/class="[^"]*\bmb-4\b/)
  })

  it('holds no hard-coded colour', () => {
    expect(html).not.toContain('#')
    expect(
      readFileSync(fileURLToPath(new URL('./awning-band.tsx', import.meta.url)), 'utf8'),
    ).not.toMatch(/#[0-9a-f]{3,8}\b/i)
  })
})

describe('awning styles', () => {
  it('defines both stripe colours in light and evening mode', () => {
    expect(block(':root')).toMatch(/--awning-a:/)
    expect(block(':root')).toMatch(/--awning-b:/)
    expect(block('.dark')).toMatch(/--awning-b:/)
  })

  it('draws the awning utility from the two stripe variables only', () => {
    const utility = block('@utility awning')
    expect(utility).toContain('var(--awning-a)')
    expect(utility).toContain('var(--awning-b)')
    expect(utility).not.toMatch(/#[0-9a-f]{3,8}\b/i)
  })
})
