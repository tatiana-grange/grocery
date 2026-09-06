import { Migration } from '@mikro-orm/migrations'

export class Migration20260905134354 extends Migration {
  override up(): void | Promise<void> {
    this.addSql(
      `create table "supplierOrder" ("id" uuid not null default gen_random_uuid(), "supplierId" uuid not null, "status" varchar(255) not null default 'draft', "sentAt" timestamptz null, "closedAt" timestamptz null, "version" int not null default 1, "createdAt" timestamptz not null, "updatedAt" timestamptz not null, primary key ("id"));`,
    )
    this.addSql(`create index "supplierOrder_supplierId_index" on "supplierOrder" ("supplierId");`)

    this.addSql(
      `create table "reception" ("id" uuid not null default gen_random_uuid(), "supplierOrderId" uuid not null, "receivedAt" timestamptz not null, "createdAt" timestamptz not null, primary key ("id"));`,
    )
    this.addSql(
      `create index "reception_supplierOrderId_index" on "reception" ("supplierOrderId");`,
    )

    this.addSql(
      `create table "supplierOrderLine" ("id" uuid not null default gen_random_uuid(), "supplierOrderId" uuid not null, "productId" uuid not null, "quantity" numeric(10,3) not null, "createdAt" timestamptz not null, "updatedAt" timestamptz not null, primary key ("id"));`,
    )
    this.addSql(
      `create index "supplierOrderLine_supplierOrderId_index" on "supplierOrderLine" ("supplierOrderId");`,
    )
    this.addSql(
      `create index "supplierOrderLine_productId_index" on "supplierOrderLine" ("productId");`,
    )
    this.addSql(
      `alter table "supplierOrderLine" add constraint "supplierOrderLine_supplierOrderId_productId_unique" unique ("supplierOrderId", "productId");`,
    )

    this.addSql(
      `create table "receptionLine" ("id" uuid not null default gen_random_uuid(), "receptionId" uuid not null, "supplierOrderLineId" uuid not null, "receivedQuantity" numeric(10,3) not null, "unitCostAmountCents" int not null, "currency" varchar(255) not null default 'EUR', "createdAt" timestamptz not null, primary key ("id"));`,
    )
    this.addSql(
      `create index "receptionLine_receptionId_index" on "receptionLine" ("receptionId");`,
    )
    this.addSql(
      `create index "receptionLine_supplierOrderLineId_index" on "receptionLine" ("supplierOrderLineId");`,
    )

    this.addSql(
      `create table "stockMovement" ("id" uuid not null default gen_random_uuid(), "productId" uuid not null, "quantity" numeric(10,3) not null, "unitCostAmountCents" int not null, "currency" varchar(255) not null default 'EUR', "reason" varchar(255) not null default 'reception', "receptionLineId" uuid null, "createdAt" timestamptz not null, primary key ("id"));`,
    )
    this.addSql(`create index "stockMovement_productId_index" on "stockMovement" ("productId");`)
    this.addSql(
      `create index "stockMovement_receptionLineId_index" on "stockMovement" ("receptionLineId");`,
    )

    this.addSql(
      `alter table "supplierOrder" add constraint "supplierOrder_supplierId_foreign" foreign key ("supplierId") references "supplier" ("id");`,
    )

    this.addSql(
      `alter table "reception" add constraint "reception_supplierOrderId_foreign" foreign key ("supplierOrderId") references "supplierOrder" ("id");`,
    )

    this.addSql(
      `alter table "supplierOrderLine" add constraint "supplierOrderLine_supplierOrderId_foreign" foreign key ("supplierOrderId") references "supplierOrder" ("id");`,
    )
    this.addSql(
      `alter table "supplierOrderLine" add constraint "supplierOrderLine_productId_foreign" foreign key ("productId") references "product" ("id");`,
    )

    this.addSql(
      `alter table "receptionLine" add constraint "receptionLine_receptionId_foreign" foreign key ("receptionId") references "reception" ("id");`,
    )
    this.addSql(
      `alter table "receptionLine" add constraint "receptionLine_supplierOrderLineId_foreign" foreign key ("supplierOrderLineId") references "supplierOrderLine" ("id");`,
    )

    this.addSql(
      `alter table "stockMovement" add constraint "stockMovement_productId_foreign" foreign key ("productId") references "product" ("id");`,
    )
    this.addSql(
      `alter table "stockMovement" add constraint "stockMovement_receptionLineId_foreign" foreign key ("receptionLineId") references "receptionLine" ("id") on delete set null;`,
    )

    this.addSql(
      `alter table "orderLine" add "supplierOrderLineId" uuid null, add "fulfilledAt" timestamptz null;`,
    )
    this.addSql(
      `alter table "orderLine" add constraint "orderLine_supplierOrderLineId_foreign" foreign key ("supplierOrderLineId") references "supplierOrderLine" ("id") on delete set null;`,
    )
    this.addSql(
      `create index "orderLine_supplierOrderLineId_index" on "orderLine" ("supplierOrderLineId");`,
    )
  }

  override down(): void | Promise<void> {
    this.addSql(`alter table "reception" drop constraint "reception_supplierOrderId_foreign";`)
    this.addSql(
      `alter table "supplierOrderLine" drop constraint "supplierOrderLine_supplierOrderId_foreign";`,
    )
    this.addSql(`alter table "receptionLine" drop constraint "receptionLine_receptionId_foreign";`)
    this.addSql(
      `alter table "receptionLine" drop constraint "receptionLine_supplierOrderLineId_foreign";`,
    )
    this.addSql(`alter table "orderLine" drop constraint "orderLine_supplierOrderLineId_foreign";`)
    this.addSql(
      `alter table "stockMovement" drop constraint "stockMovement_receptionLineId_foreign";`,
    )

    this.addSql(`drop table if exists "supplierOrder" cascade;`)
    this.addSql(`drop table if exists "reception" cascade;`)
    this.addSql(`drop table if exists "supplierOrderLine" cascade;`)
    this.addSql(`drop table if exists "receptionLine" cascade;`)
    this.addSql(`drop table if exists "stockMovement" cascade;`)

    this.addSql(`drop index "orderLine_supplierOrderLineId_index";`)
    this.addSql(
      `alter table "orderLine" drop column "supplierOrderLineId", drop column "fulfilledAt";`,
    )
  }
}
