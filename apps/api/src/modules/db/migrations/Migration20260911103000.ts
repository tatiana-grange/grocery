import { Migration } from '@mikro-orm/migrations'
import { SEARCH_NORMALIZATION_DDL } from '../search.util'

/**
 * Makes every search box in the app accent- and case-insensitive.
 *
 * The `normalize_search` definition lives in `../search.util` so the queries that call it and
 * the indexes built on it can never drift apart — see the comment there.
 *
 * The GIN trigram indexes are what keep a leading-wildcard `like '%…%'` off a sequential scan.
 */
export class Migration20260911103000 extends Migration {
  override up(): void | Promise<void> {
    for (const statement of SEARCH_NORMALIZATION_DDL) this.addSql(statement)

    this.addSql(
      `create index "product_name_search_idx" on "product" using gin (normalize_search("name") gin_trgm_ops);`,
    )
    this.addSql(
      `create index "product_description_search_idx" on "product" using gin (normalize_search("description") gin_trgm_ops);`,
    )
    this.addSql(
      `create index "product_barcode_search_idx" on "product" using gin (normalize_search("barcode") gin_trgm_ops);`,
    )
    this.addSql(
      `create index "category_name_search_idx" on "category" using gin (normalize_search("name") gin_trgm_ops);`,
    )
    this.addSql(
      `create index "member_membershipNumber_search_idx" on "member" using gin (normalize_search("membershipNumber") gin_trgm_ops);`,
    )
    this.addSql(
      `create index "user_name_search_idx" on "user" using gin (normalize_search("name") gin_trgm_ops);`,
    )
    this.addSql(
      `create index "user_email_search_idx" on "user" using gin (normalize_search("email") gin_trgm_ops);`,
    )
    this.addSql(
      `create index "user_phoneNumber_search_idx" on "user" using gin (normalize_search("phoneNumber") gin_trgm_ops);`,
    )
  }

  override down(): void | Promise<void> {
    this.addSql(`drop index if exists "user_phoneNumber_search_idx";`)
    this.addSql(`drop index if exists "user_email_search_idx";`)
    this.addSql(`drop index if exists "user_name_search_idx";`)
    this.addSql(`drop index if exists "member_membershipNumber_search_idx";`)
    this.addSql(`drop index if exists "category_name_search_idx";`)
    this.addSql(`drop index if exists "product_barcode_search_idx";`)
    this.addSql(`drop index if exists "product_description_search_idx";`)
    this.addSql(`drop index if exists "product_name_search_idx";`)
    this.addSql(`drop function if exists normalize_search(text);`)
  }
}
