import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const srcDir = fileURLToPath(new URL('..', import.meta.url))

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) return sourceFiles(path)
    const isSource = /\.tsx?$/.test(entry.name) && !/\.spec\.tsx?$/.test(entry.name)
    return isSource ? [path] : []
  })
}

const files = sourceFiles(srcDir).map((path) => ({
  name: relative(srcDir, path),
  text: readFileSync(path, 'utf8'),
}))

/** Every place where `pattern` matches, as `file: match`. */
function find(pattern: RegExp): string[] {
  return files.flatMap(({ name, text }) =>
    [...text.matchAll(pattern)].map((match) => `${name}: ${match[0]}`),
  )
}

describe('shared component rules', () => {
  it('does not force capital letters', () => {
    expect(find(/(?<![\w-])uppercase(?![\w-])/g)).toEqual([])
  })

  it('has no arbitrary text size under 14 px', () => {
    const tooSmall = find(/text-\[\d*\.?\d+(?:px|rem)\]/g).filter((hit) => {
      const [, value, unit] = hit.match(/\[(\d*\.?\d+)(px|rem)\]/)!
      return parseFloat(value) * (unit === 'rem' ? 16 : 1) < 14
    })
    expect(tooSmall).toEqual([])
  })

  it('never writes sage text, which fails 4.5:1 on slate', () => {
    expect(find(/text-primary(?![\w-])/g)).toEqual([])
  })

  it('never writes squash text, which fails 4.5:1 on cream', () => {
    expect(find(/text-warning(?![\w-])/g)).toEqual([])
  })
})
