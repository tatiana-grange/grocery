import { Migration } from '@mikro-orm/migrations'

/**
 * Referents, producer categories, and a delivery mode on suppliers.
 *
 * Trimmed to these catalog additions only. The generator also emitted DDL for the
 * `orders`/`cart` module (tables `order`, `orderLine`, `cart`, `cartLine`, and
 * `product.orderingMode`) that belongs to this feature but was missed here — it's applied
 * separately by Migration20260904140000, hand-written since `.snapshot-grocery.json` already
 * described those tables and wouldn't re-surface the diff via `migration:create`.
 */
export class Migration20260904135812 extends Migration {
  override up(): void | Promise<void> {
    this.addSql(
      `create table "producerCategory" ("id" uuid not null default gen_random_uuid(), "name" varchar(255) not null, "archivedAt" timestamptz null, "version" int not null default 1, "createdAt" timestamptz not null, "updatedAt" timestamptz not null, primary key ("id"));`,
    )
    this.addSql(`create index "producerCategory_name_index" on "producerCategory" ("name");`)
    this.addSql(
      `create index "producerCategory_archivedAt_index" on "producerCategory" ("archivedAt");`,
    )

    this.addSql(
      `create table "referent" ("id" uuid not null default gen_random_uuid(), "firstName" varchar(255) null, "lastName" varchar(255) not null, "contactEmail" varchar(255) null, "contactPhone" varchar(255) null, "userId" uuid null, "version" int not null default 1, "createdAt" timestamptz not null, "updatedAt" timestamptz not null, primary key ("id"));`,
    )
    this.addSql(`create index "referent_lastName_index" on "referent" ("lastName");`)

    this.addSql(
      `create table "supplierProducerCategory" ("supplier" uuid not null, "producerCategory" uuid not null, primary key ("supplier", "producerCategory"));`,
    )

    this.addSql(
      `alter table "referent" add constraint "referent_userId_foreign" foreign key ("userId") references "user" ("id") on delete set null;`,
    )

    this.addSql(
      `alter table "supplierProducerCategory" add constraint "supplierProducerCategory_supplier_foreign" foreign key ("supplier") references "supplier" ("id") on update cascade on delete cascade;`,
    )
    this.addSql(
      `alter table "supplierProducerCategory" add constraint "supplierProducerCategory_producerCategory_foreign" foreign key ("producerCategory") references "producerCategory" ("id") on update cascade on delete cascade;`,
    )

    this.addSql(
      `alter table "supplier" add "deliveryMode" varchar(255) null, add "referentId" uuid null;`,
    )
    this.addSql(
      `alter table "supplier" add constraint "supplier_referentId_foreign" foreign key ("referentId") references "referent" ("id") on delete set null;`,
    )
    this.addSql(`create index "supplier_referentId_index" on "supplier" ("referentId");`)
  }

  override down(): void | Promise<void> {
    this.addSql(
      `alter table "supplierProducerCategory" drop constraint "supplierProducerCategory_producerCategory_foreign";`,
    )
    this.addSql(`alter table "supplier" drop constraint "supplier_referentId_foreign";`)

    this.addSql(`drop table if exists "producerCategory" cascade;`)
    this.addSql(`drop table if exists "referent" cascade;`)
    this.addSql(`drop table if exists "supplierProducerCategory" cascade;`)

    this.addSql(`drop index "supplier_referentId_index";`)
    this.addSql(`alter table "supplier" drop column "deliveryMode", drop column "referentId";`)
  }
}
