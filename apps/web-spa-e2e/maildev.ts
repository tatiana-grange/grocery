import { E2E } from './env'

interface MaildevMessage {
  id: string
  time: string
  subject: string
  text?: string
  html?: string
  to: { address: string; name?: string }[]
}

async function fetchMessages(): Promise<MaildevMessage[]> {
  const response = await fetch(`${E2E.maildevUrl}/email`)
  if (!response.ok) {
    throw new Error(`maildev a répondu ${response.status} — le conteneur est-il démarré ?`)
  }
  return (await response.json()) as MaildevMessage[]
}

/** Supprime tous les messages pour qu'un poll ne voie que les mails envoyés après cet appel. */
export async function clearMailbox(): Promise<void> {
  await fetch(`${E2E.maildevUrl}/email/all`, { method: 'DELETE' })
}

async function pollLatestMessage(
  email: string,
  { timeoutMs = 15_000, intervalMs = 500 }: { timeoutMs?: number; intervalMs?: number } = {},
): Promise<MaildevMessage> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const messages = await fetchMessages()
    const match = messages
      .filter((message) =>
        message.to.some((recipient) => recipient.address.toLowerCase() === email.toLowerCase()),
      )
      .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())[0]
    if (match) return match
    await new Promise((r) => setTimeout(r, intervalMs))
  }
  throw new Error(`Aucun mail pour ${email} en ${timeoutMs}ms`)
}

/**
 * Attend le mail de réinitialisation de mot de passe et renvoie son token.
 * `AuthModule` envoie un lien `${CLIENTS_WEB_APP_URL}/reset-password?token=<token>`.
 */
export async function readResetPasswordToken(email: string): Promise<string> {
  const message = await pollLatestMessage(email)
  const body = message.html ?? message.text ?? ''
  const token = body.match(/reset-password\?token=([A-Za-z0-9._-]+)/)?.[1]
  if (!token) {
    throw new Error(`Pas de token de réinitialisation dans le mail pour ${email}`)
  }
  return token
}
