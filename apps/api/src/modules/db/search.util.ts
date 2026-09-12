import type { EntityManager, FilterQuery } from '@mikro-orm/core'
import { raw } from '@mikro-orm/core'

/**
 * Installs one of the two extensions search depends on, and says something useful when it
 * cannot.
 *
 * Creating an extension needs privileges the application's role often does not have on a
 * managed Postgres. Installing one that is already there needs none, so this only reaches for
 * `create extension` when the extension is genuinely missing — a database whose extensions were
 * installed by an administrator goes straight through. When it is missing *and* out of reach,
 * a bare "permission denied" in the middle of a deploy is replaced by the command an
 * administrator has to run.
 */
function installExtension(name: string): string {
  return `do $$
    begin
      if not exists (select 1 from pg_extension where extname = '${name}') then
        create extension "${name}";
      end if;
    exception when insufficient_privilege then
      raise exception 'The "${name}" extension is required for accent-insensitive search, is not installed, and this database role may not create it. Ask an administrator to run: create extension "${name}";';
    end
  $$;`
}

/**
 * Every search box in the app compares text through `normalize_search`: it lower-cases the value
 * and strips its diacritics, so "biere" finds "BIÈRE" and "Bière" finds "biere".
 *
 * It lives in the database rather than as a `toLowerCase()` in TypeScript for two reasons. The
 * GIN trigram indexes are built on the very same expression, which is what keeps a
 * `like '%…%'` off a sequential scan. And one definition cannot drift from the other.
 *
 * `unaccent` is called in its two-argument form on purpose: the one-argument form resolves the
 * default dictionary at run time and is therefore only STABLE, while an index expression has to
 * be IMMUTABLE.
 *
 * Owned by `Migration20260911103000`. The statements are exported because the function is not
 * part of entity metadata, so every path that builds a schema without replaying the migrations
 * has to create it by hand — see `applySearchNormalization`.
 */
export const SEARCH_NORMALIZATION_DDL: readonly string[] = [
  installExtension('unaccent'),
  installExtension('pg_trgm'),
  `create or replace function normalize_search(value text) returns text
     language sql immutable parallel safe
     as $$ select lower(public.unaccent('public.unaccent'::regdictionary, coalesce(value, ''))) $$;`,
]

/**
 * Creates `normalize_search` on a database whose schema was built from entity metadata rather
 * than from the migrations — `schema:fresh`, `orm.schema.refresh()`. Without it every list
 * endpoint 500s as soon as someone types in a search box.
 *
 * Call it from any seeder that can be the `--seed` target of a fresh schema, and from the test
 * database helper. It is idempotent, so calling it twice costs nothing.
 */
export async function applySearchNormalization(em: EntityManager): Promise<void> {
  for (const statement of SEARCH_NORMALIZATION_DDL) {
    await em.getConnection().execute(statement)
  }
}

/** `%`, `_` and `\` are LIKE syntax — escape them so the user's text is matched literally. */
function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`)
}

/**
 * The `$or` behind a `q` filter: the term matches when it appears anywhere inside any of
 * `paths`. A path is either a column of the entity (`'name'`) or a column reached through a
 * relation (`'category.name'`, `'user.email'`), which MikroORM joins for us.
 *
 * `paths` are developer-written literals, never request input — they are interpolated into the
 * SQL, whereas the searched term is always bound as a parameter.
 */
export function buildSearchFilter<T extends object>(
  term: string,
  paths: readonly string[],
): FilterQuery<T> {
  const pattern = `%${escapeLike(term)}%`
  return { $or: paths.map((path) => matchesTerm(path, pattern)) } as FilterQuery<T>
}

function matchesTerm(path: string, pattern: string): Record<string, unknown> {
  const segments = path.split('.')
  const column = segments.pop()
  const condition = {
    [raw((alias) => `normalize_search(${alias}."${column}") like normalize_search(?)`, [pattern])]:
      [],
  }
  return segments.reduceRight<Record<string, unknown>>(
    (nested, relation) => ({ [relation]: nested }),
    condition,
  )
}
