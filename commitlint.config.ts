import { type Rule, type UserConfig, RuleConfigSeverity } from '@commitlint/types'

/**
 * Conventional Commits 1.0.0 types. This is the single source of truth.
 * Do not restate this list in docs or workflows.
 */
export const TYPES = [
  'feat',
  'fix',
  'docs',
  'style',
  'refactor',
  'perf',
  'test',
  'build',
  'ci',
  'chore',
  'revert',
] as const

export type CommitType = (typeof TYPES)[number]

/**
 * Commit scopes = Boilerstone tracked domains, plus `boilerstone`.
 * Consumer projects edit this array; do not copy it into prose.
 */
export const SCOPES = [
  'tooling',
  'api',
  'frontend',
  'auth',
  'email',
  'storage',
  'monitoring',
  'ai',
  'docker-env',
  'ci',
  'boilerstone',
] as const

export type CommitScope = (typeof SCOPES)[number]

/**
 * One gitmoji per type. The subject must open with its type's emoji:
 * `feat(api): ✨ add a per-product quantity step`.
 *
 * The emoji goes after the colon, never before the type and never instead of
 * it. A header that opens with an emoji stops parsing as a Conventional
 * Commit, and release-please would then drop the commit from the changelog
 * and from the version math without saying so.
 *
 * This table is the single source of truth. Do not restate it in prose.
 */
export const TYPE_EMOJI = {
  feat: '✨',
  fix: '🐛',
  docs: '📝',
  style: '🎨',
  refactor: '♻️',
  perf: '⚡',
  test: '✅',
  build: '📦',
  ci: '👷',
  chore: '🔧',
  revert: '⏪',
} as const satisfies Record<CommitType, string>

/**
 * Words that mean the PR was not finalized. Checked on the title and on
 * conventional paragraphs in the description (changelog entries), not on
 * rationale prose. A hit is a standalone leftover subject (`chore(auth): 🔧 fmt`)
 * or a first-word leftover (`feat(auth): ✨ wip revocation`). Phrases such as
 * "do not merge" match anywhere in the subject description.
 */
export const WIP_WORDS = [
  'wip',
  'fixup',
  'squash',
  'tmp',
  'temp',
  'oops',
  'typo',
  'fmt',
  'lint',
  'do not merge',
  'wtf',
] as const

/**
 * Trailing leftovers of a second attempt (`… 2`, `… again`).
 * Applied to the same changelog-bound strings as `WIP_WORDS`.
 */
export const WIP_TRAILING_PATTERNS: ReadonlyArray<{ label: string; pattern: RegExp }> = [
  { label: '2', pattern: /\s+2$/u },
  { label: 'again', pattern: /\s+again$/iu },
]

/**
 * Some gitmoji carry a variation selector (`♻️` is `♻` + U+FE0F). Editors and
 * agents drop it inconsistently, so compare without it.
 */
function withoutVariationSelector(value: string): string {
  return value.replace(/\uFE0F/gu, '')
}

function isCommitType(value: string): value is CommitType {
  return (TYPES as readonly string[]).includes(value)
}

/**
 * Remove the leading gitmoji from a subject, so the words that follow can be
 * checked on their own (WIP leftovers, casing).
 */
export function stripGitmoji(subject: string): string {
  const normalized = withoutVariationSelector(subject)
  for (const emoji of Object.values(TYPE_EMOJI)) {
    const marker = withoutVariationSelector(emoji)
    if (normalized.startsWith(marker)) {
      return normalized.slice(marker.length).trim()
    }
  }
  return subject
}

/**
 * The subject must open with the gitmoji of its own type. Unknown types and
 * empty subjects are left to `type-enum` and `subject-empty`, which already
 * report them with a better message.
 */
const subjectGitmoji: Rule = (parsed) => {
  const { type, subject } = parsed
  if (type === null || !isCommitType(type)) {
    return [true]
  }
  if (subject === null || subject.trim() === '') {
    return [true]
  }

  const expected = TYPE_EMOJI[type]
  const normalizedSubject = withoutVariationSelector(subject)
  const marker = withoutVariationSelector(expected)

  if (!normalizedSubject.startsWith(`${marker} `)) {
    return [
      false,
      `subject must start with "${expected} ", the gitmoji for '${type}' — write \`${type}(scope): ${expected} description\`. The table lives in commitlint.config.ts`,
    ]
  }

  if (normalizedSubject.slice(marker.length).trim() === '') {
    return [false, `subject must say what changed after ${expected}`]
  }

  return [true]
}

const config: UserConfig = {
  extends: ['@commitlint/config-conventional'],
  helpUrl: 'See CONTRIBUTING.md. Valid types, scopes, and gitmoji live in commitlint.config.ts.',
  plugins: [{ rules: { 'subject-gitmoji': subjectGitmoji } }],
  rules: {
    'type-enum': [RuleConfigSeverity.Error, 'always', [...TYPES]],
    'scope-empty': [RuleConfigSeverity.Error, 'never'],
    'scope-enum': [RuleConfigSeverity.Error, 'always', [...SCOPES]],
    'subject-gitmoji': [RuleConfigSeverity.Error, 'always'],
  },
}

export default config
