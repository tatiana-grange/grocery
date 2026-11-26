export type MembershipSmsOutcome = 'validated' | 'rejected' | 'terminated' | 'reactivated'

/** The SMS a member without a real address gets: the short form of the membership mail. */
export function membershipSmsText(input: {
  outcome: MembershipSmsOutcome
  cooperativeName: string
  reason?: string
}): string {
  const { outcome, cooperativeName, reason } = input
  const withReason = (sentence: string): string =>
    reason ? `${sentence} Motif : ${reason}` : sentence
  switch (outcome) {
    case 'validated':
      return `Votre adhésion à ${cooperativeName} est confirmée. Vous pouvez maintenant vous connecter.`
    case 'rejected':
      return withReason(`Votre demande d'adhésion à ${cooperativeName} n'a pas été acceptée.`)
    case 'terminated':
      return withReason(`Votre adhésion à ${cooperativeName} a pris fin.`)
    case 'reactivated':
      return `Votre adhésion à ${cooperativeName} est de nouveau active. Vous pouvez vous connecter à nouveau.`
  }
}
