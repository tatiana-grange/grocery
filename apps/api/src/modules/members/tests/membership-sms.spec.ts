import { membershipSmsText } from '../membership-sms'

type Outcome = Parameters<typeof membershipSmsText>[0]['outcome']

const OUTCOMES: Outcome[] = ['validated', 'rejected', 'terminated', 'reactivated']
const ENGLISH_WORDS = /\b(hello|your|please|reason)\b/i

describe('membershipSmsText', () => {
  it.each(OUTCOMES)('writes the %s message in French and names the cooperative', (outcome) => {
    const text = membershipSmsText({ outcome, cooperativeName: "Lay'picerie", reason: 'Test' })

    expect(text).not.toMatch(ENGLISH_WORDS)
    expect(text).toContain("Lay'picerie")
  })

  it('confirms a membership', () => {
    expect(membershipSmsText({ outcome: 'validated', cooperativeName: 'Coop' })).toBe(
      'Votre adhésion à Coop est confirmée. Vous pouvez maintenant vous connecter.',
    )
  })

  it('tells a member that the membership is active again', () => {
    expect(membershipSmsText({ outcome: 'reactivated', cooperativeName: 'Coop' })).toBe(
      'Votre adhésion à Coop est de nouveau active. Vous pouvez vous connecter à nouveau.',
    )
  })

  it.each([
    ['rejected', "Votre demande d'adhésion à Coop n'a pas été acceptée."],
    ['terminated', 'Votre adhésion à Coop a pris fin.'],
  ] as const)('gives the reason of the %s message only when given', (outcome, sentence) => {
    expect(membershipSmsText({ outcome, cooperativeName: 'Coop' })).toBe(sentence)
    expect(
      membershipSmsText({ outcome, cooperativeName: 'Coop', reason: 'Dossier incomplet' }),
    ).toBe(`${sentence} Motif : Dossier incomplet`)
  })
})
