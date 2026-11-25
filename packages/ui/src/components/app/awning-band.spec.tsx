import { readFileSync } from 'node:fs'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { readCssBlock } from '../../styles/read-css-block'
import { AwningBand } from './awning-band'

const css = readFileSync(new URL('../../styles/globals.css', import.meta.url), 'utf8')
const componentSource = readFileSync(new URL('./awning-band.tsx', import.meta.url), 'utf8')
const hexColour = /#[0-9a-f]{3,8}\b/i

describe('AwningBand', () => {
  it('is hidden from assistive technology', () => {
    const actualHtml = renderToStaticMarkup(<AwningBand />)

    expect(actualHtml).toContain('aria-hidden="true"')
  })

  it('carries its data-slot and the awning class', () => {
    const actualHtml = renderToStaticMarkup(<AwningBand />)

    expect(actualHtml).toContain('data-slot="awning-band"')
    expect(actualHtml).toMatch(/class="[^"]*\bawning\b/)
  })

  it('keeps a className passed by the caller', () => {
    const actualHtml = renderToStaticMarkup(<AwningBand className="mb-4" />)

    expect(actualHtml).toMatch(/class="[^"]*\bmb-4\b/)
  })

  it('holds no hard-coded colour', () => {
    const actualHtml = renderToStaticMarkup(<AwningBand />)

    expect(actualHtml).not.toContain('#')
    expect(componentSource).not.toMatch(hexColour)
  })
})

describe('awning styles', () => {
  it('defines both stripe colours in light and evening mode', () => {
    const actualLight = readCssBlock(css, ':root')
    const actualDark = readCssBlock(css, '.dark')

    expect(actualLight).toMatch(/--awning-a:/)
    expect(actualLight).toMatch(/--awning-b:/)
    expect(actualDark).toMatch(/--awning-b:/)
  })

  it('draws the awning utility from the two stripe variables only', () => {
    const actualUtility = readCssBlock(css, '@utility awning')

    expect(actualUtility).toContain('var(--awning-a)')
    expect(actualUtility).toContain('var(--awning-b)')
    expect(actualUtility).not.toMatch(hexColour)
  })
})
