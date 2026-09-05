import { Migration } from '@mikro-orm/migrations'

/**
 * Orders/cart: the DDL that Migration20260904135812 removed by hand as "someone else's
 * work-in-progress" — it wasn't; it's this feature's own tables, missed on that branch.
 * `.snapshot-grocery.json` already described these tables (Migration20260904135812's own
 * comment flagged that), so `migration:create` would not re-surface this diff on its own.
 */
export class Migration20260904140000 extends Migration {
  override up(): void | Promise<void> {
    this.addSql(
      `alter table "product" add column "orderingMode" varchar(255) not null default 'in_store';`,
    )

    this.addSql(
      `create table "cart" ("id" uuid not null default gen_random_uuid(), "memberId" uuid not null, "version" int not null default 1, "createdAt" timestamptz not null, "updatedAt" timestamptz not null, primary key ("id"));`,
    )
    this.addSql(`create index "cart_memberId_index" on "cart" ("memberId");`)
    this.addSql(`alter table "cart" add constraint "cart_memberId_unique" unique ("memberId");`)

    this.addSql(
      `create table "order" ("id" uuid not null default gen_random_uuid(), "memberId" uuid not null, "orderingMode" varchar(255) not null, "status" varchar(255) not null default 'pending', "totalAmountCents" int not null, "currency" varchar(255) not null default 'EUR', "placedAt" timestamptz not null, "cancelledAt" timestamptz null, "version" int not null default 1, "createdAt" timestamptz not null, "updatedAt" timestamptz not null, primary key ("id"));`,
    )
    this.addSql(`create index "order_memberId_index" on "order" ("memberId");`)

    this.addSql(
      `create table "cartLine" ("id" uuid not null default gen_random_uuid(), "cartId" uuid not null, "productId" uuid not null, "orderingMode" varchar(255) not null, "quantity" numeric(10,3) not null, "createdAt" timestamptz not null, "updatedAt" timestamptz not null, primary key ("id"));`,
    )
    this.addSql(`create index "cartLine_cartId_index" on "cartLine" ("cartId");`)
    this.addSql(`create index "cartLine_productId_index" on "cartLine" ("productId");`)
    this.addSql(
      `alter table "cartLine" add constraint "cartLine_cartId_productId_orderingMode_unique" unique ("cartId", "productId", "orderingMode");`,
    )

    this.addSql(
      `create table "orderLine" ("id" uuid not null default gen_random_uuid(), "orderId" uuid not null, "productId" uuid not null, "productNameSnapshot" varchar(255) not null, "quantity" numeric(10,3) not null, "unitPriceAmountCents" int not null, "lineTotalAmountCents" int not null, "createdAt" timestamptz not null, primary key ("id"));`,
    )
    this.addSql(`create index "orderLine_orderId_index" on "orderLine" ("orderId");`)

    this.addSql(
      `alter table "cart" add constraint "cart_memberId_foreign" foreign key ("memberId") references "member" ("id");`,
    )
    this.addSql(
      `alter table "order" add constraint "order_memberId_foreign" foreign key ("memberId") references "member" ("id");`,
    )
    this.addSql(
      `alter table "cartLine" add constraint "cartLine_cartId_foreign" foreign key ("cartId") references "cart" ("id");`,
    )
    this.addSql(
      `alter table "cartLine" add constraint "cartLine_productId_foreign" foreign key ("productId") references "product" ("id");`,
    )
    this.addSql(
      `alter table "orderLine" add constraint "orderLine_orderId_foreign" foreign key ("orderId") references "order" ("id");`,
    )
    this.addSql(
      `alter table "orderLine" add constraint "orderLine_productId_foreign" foreign key ("productId") references "product" ("id");`,
    )
  }

  override down(): void | Promise<void> {
    this.addSql(`drop table if exists "orderLine" cascade;`)
    this.addSql(`drop table if exists "cartLine" cascade;`)
    this.addSql(`drop table if exists "order" cascade;`)
    this.addSql(`drop table if exists "cart" cascade;`)
    this.addSql(`alter table "product" drop column "orderingMode";`)
  }
}
