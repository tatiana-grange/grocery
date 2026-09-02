import { Migration } from '@mikro-orm/migrations'

/**
 * Enforce "exactly one open price per product" at the database level.
 *
 * `CatalogService.setProductPrice` now takes a pessimistic lock on the product row, but the
 * partial unique index is the durable backstop: without it, two price changes that raced
 * before this change could each have closed the current row and inserted a new open one,
 * leaving two rows with `validTo IS NULL` and an ambiguous current price.
 *
 * The pre-index cleanup keeps only the most recent open row per product (by `validFrom`,
 * then `createdAt`) and closes the rest, so the index can be created on existing data.
 *
 * `if not exists` keeps this safe on a database whose schema was built straight from the
 * entities (`db:fresh` / `db:sync`), where the index defined on `ProductPrice` already exists.
 */
export class Migration20260902130000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`
      with ranked as (
        select "id",
               row_number() over (
                 partition by "productId"
                 order by "validFrom" desc, "createdAt" desc
               ) as rn
        from "productPrice"
        where "validTo" is null
      )
      update "productPrice" p
      set "validTo" = now()
      from ranked
      where ranked."id" = p."id" and ranked.rn > 1;
    `)

    this.addSql(
      `create unique index if not exists "productPrice_one_open_per_product" on "productPrice" ("productId") where "validTo" is null;`,
    )
  }

  override async down(): Promise<void> {
    this.addSql(`drop index if exists "productPrice_one_open_per_product";`)
  }
}
