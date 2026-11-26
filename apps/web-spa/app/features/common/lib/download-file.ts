/** How long the file URL stays valid after the click: Safari and Firefox read it a little later. */
const REVOKE_DELAY_MS = 10_000

/** Hands a text file to the browser as a download. */
export function downloadFile(fileName: string, content: string, type: string): void {
  const url = URL.createObjectURL(new Blob([content], { type }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  anchor.click()
  setTimeout(() => URL.revokeObjectURL(url), REVOKE_DELAY_MS)
}
