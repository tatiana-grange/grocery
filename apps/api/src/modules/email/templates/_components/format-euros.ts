/** "5,00 €" from cents. Negative amounts keep their minus sign. */
export function formatEuros(cents: number): string {
  return `${(cents / 100).toFixed(2).replace('.', ',')} €`
}
