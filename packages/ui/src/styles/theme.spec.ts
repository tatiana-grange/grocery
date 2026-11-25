import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const cssPath = fileURLToPath(new URL('./globals.css', import.meta.url))
const packagePath = fileURLToPath(new URL('../../package.json', import.meta.url))
const css = readFileSync(cssPath, 'utf8')

type Mode = 'light' | 'dark'

/** The body of the first top-level block that starts with `selector {`. */
function block(selector: string): string {
  const start = css.indexOf(`${selector} {`)
  if (start === -1) throw new Error(`No ${selector} block in globals.css`)
  const open = css.indexOf('{', start)
  let depth = 0
  for (let i = open; i < css.length; i++) {
    if (css[i] === '{') depth++
    if (css[i] === '}') depth--
    if (depth === 0) return css.slice(open + 1, i)
  }
  throw new Error(`Unclosed ${selector} block`)
}

function declarations(body: string): Record<string, string> {
  const result: Record<string, string> = {}
  for (const match of body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
    result[match[1]] = match[2].trim()
  }
  return result
}

const light = declarations(block(':root'))
// Evening mode only overrides some tokens: the rest is inherited from light.
const dark = { ...light, ...declarations(block('.dark')) }
const modes: Record<Mode, Record<string, string>> = { light, dark }

function luminance(hex: string): number {
  const channels = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
  const [r, g, b] = channels.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

function token(mode: Mode, name: string): string {
  const value = modes[mode][`--${name}`]
  if (!value) throw new Error(`--${name} is not defined in ${mode} mode`)
  return value.toUpperCase()
}

describe('market palette, light mode', () => {
  const expected: Record<string, string> = {
    background: '#F7F1E3',
    foreground: '#2B241C',
    card: '#FFFCF5',
    'card-foreground': '#2B241C',
    popover: '#FFFCF5',
    'popover-foreground': '#2B241C',
    muted: '#EDE4D0',
    'muted-foreground': '#5C5246',
    accent: '#EDE4D0',
    'accent-foreground': '#2B241C',
    primary: '#4E6B4A',
    'primary-foreground': '#FFFCF5',
    secondary: '#D9C3A0',
    'secondary-foreground': '#2B241C',
    warning: '#B4541A',
    'warning-foreground': '#FFFCF5',
    destructive: '#9B2C22',
    'destructive-foreground': '#FFFCF5',
    success: '#3B6E3F',
    'success-foreground': '#FFFCF5',
    info: '#2F5D73',
    'info-foreground': '#FFFCF5',
    straw: '#E9C46A',
    'straw-foreground': '#2B241C',
    kraft: '#D9C3A0',
    'kraft-foreground': '#2B241C',
    slate: '#2F3A33',
    'slate-foreground': '#F7F1E3',
    border: '#2B241C',
    input: '#2B241C',
    rule: '#D9C3A0',
    ring: '#4E6B4A',
    'awning-a': '#4E6B4A',
    'awning-b': '#FFFCF5',
    sidebar: '#FFFCF5',
    'sidebar-foreground': '#2B241C',
    'sidebar-primary': '#4E6B4A',
    'sidebar-primary-foreground': '#FFFCF5',
    'sidebar-accent': '#EDE4D0',
    'sidebar-accent-foreground': '#2B241C',
    'sidebar-border': '#D9C3A0',
    'sidebar-ring': '#4E6B4A',
  }
  for (const [name, value] of Object.entries(expected)) {
    it(`--${name} is ${value}`, () => {
      expect(token('light', name)).toBe(value)
    })
  }

  it('keeps no Citrus oklch value in :root or .dark', () => {
    expect(block(':root')).not.toContain('oklch(')
    expect(block('.dark')).not.toContain('oklch(')
  })
})

describe('evening mode', () => {
  const expected: Record<string, string> = {
    background: '#2F3A33',
    foreground: '#F7F1E3',
    card: '#3A473F',
    'card-foreground': '#F7F1E3',
    popover: '#3A473F',
    'popover-foreground': '#F7F1E3',
    muted: '#26302A',
    'muted-foreground': '#D3C9B3',
    accent: '#46544B',
    'accent-foreground': '#F7F1E3',
    destructive: '#F2A595',
    'destructive-foreground': '#2B241C',
    border: '#D9C3A0',
    input: '#D9C3A0',
    rule: '#5E6E63',
    ring: '#E9C46A',
    'awning-b': '#F7F1E3',
    sidebar: '#26302A',
    'sidebar-foreground': '#F7F1E3',
    'sidebar-accent': '#46544B',
    'sidebar-accent-foreground': '#F7F1E3',
    'sidebar-border': '#5E6E63',
    'sidebar-ring': '#E9C46A',
  }
  for (const [name, value] of Object.entries(expected)) {
    it(`--${name} is ${value}`, () => {
      expect(token('dark', name)).toBe(value)
    })
  }

  it('keeps sage primary and squash warning the same as in light mode', () => {
    expect(token('dark', 'primary')).toBe(token('light', 'primary'))
    expect(token('dark', 'warning')).toBe(token('light', 'warning'))
  })
})

describe('fonts', () => {
  it('no longer imports or depends on Host Grotesk', () => {
    // Built in two parts so this file does not match its own search.
    const name = ['host', 'grotesk'].join('-')
    expect(css.toLowerCase()).not.toContain(name)
    expect(readFileSync(packagePath, 'utf8').toLowerCase()).not.toContain(name)
  })

  it('draws headings in Lora through --font-display', () => {
    expect(light['--font-display']).toBe('var(--font-serif)')
    expect(light['--font-serif']).toContain('Lora Variable')
    expect(light['--font-sans']).toContain('Onest Variable')
  })
})

describe('text scale', () => {
  it('makes the body text 18 px', () => {
    expect(declarations(block('@theme'))['--text-base']).toBe('1.125rem')
  })
  it('keeps the smallest class at 14 px or more', () => {
    expect(parseFloat(declarations(block('@theme'))['--text-xs'])).toBeGreaterThanOrEqual(0.875)
  })
})

describe('contrast of every text-on-background pair', () => {
  const pairs: Array<[string, string]> = [
    ['foreground', 'background'],
    ['card-foreground', 'card'],
    ['popover-foreground', 'popover'],
    ['muted-foreground', 'background'],
    ['muted-foreground', 'card'],
    ['muted-foreground', 'muted'],
    ['muted-foreground', 'accent'],
    ['accent-foreground', 'accent'],
    ['primary-foreground', 'primary'],
    ['secondary-foreground', 'secondary'],
    ['destructive-foreground', 'destructive'],
    ['destructive', 'background'],
    ['destructive', 'card'],
    ['warning-foreground', 'warning'],
    ['success-foreground', 'success'],
    ['info-foreground', 'info'],
    ['straw-foreground', 'straw'],
    ['kraft-foreground', 'kraft'],
    ['slate-foreground', 'slate'],
    ['sidebar-foreground', 'sidebar'],
    ['sidebar-accent-foreground', 'sidebar-accent'],
    ['background', 'foreground'],
  ]
  for (const mode of ['light', 'dark'] as const) {
    for (const [fg, bg] of pairs) {
      it(`${mode}: ${fg} on ${bg} is at least 4.5:1`, () => {
        expect(contrast(token(mode, fg), token(mode, bg))).toBeGreaterThanOrEqual(4.5)
      })
    }
  }
})
