/**
 * Returns the text between the braces of the first block that starts with `selector {`, for
 * example `:root`, `.dark`, `@theme` or `@utility awning`. Nested braces are balanced.
 * Throws when the selector is not in `css` or its block is never closed.
 */
export function readCssBlock(css: string, selector: string): string {
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
