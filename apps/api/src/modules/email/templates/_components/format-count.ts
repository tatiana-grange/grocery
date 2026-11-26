/** "2 commandes" from a count, with the singular for 1 and the plural otherwise. */
export function formatCount({
  count,
  one,
  many,
}: {
  count: number
  one: string
  many: string
}): string {
  return `${count} ${count === 1 ? one : many}`
}
