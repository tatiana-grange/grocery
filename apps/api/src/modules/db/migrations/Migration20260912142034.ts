import { Migration } from '@mikro-orm/migrations';

export class Migration20260912142034 extends Migration {

  override up(): void | Promise<void> {
    this.addSql(`create table "handover" ("id" uuid not null default gen_random_uuid(), "orderId" uuid not null, "memberId" uuid not null, "totalAmountCents" int not null, "currency" varchar(255) not null default 'EUR', "kind" varchar(255) not null default 'handover', "reversesHandoverId" uuid null, "recordedByUserId" uuid not null, "note" varchar(255) null, "createdAt" timestamptz not null, primary key ("id"));`);
    this.addSql(`create index "handover_orderId_index" on "handover" ("orderId");`);
    this.addSql(`create index "handover_memberId_index" on "handover" ("memberId");`);
    this.addSql(`create index "handover_reversesHandoverId_index" on "handover" ("reversesHandoverId");`);

    this.addSql(`create table "handoverLine" ("id" uuid not null default gen_random_uuid(), "handoverId" uuid not null, "orderLineId" uuid not null, "handedQuantity" numeric(10,3) not null, "unitPriceAmountCents" int not null, "lineTotalAmountCents" int not null, "createdAt" timestamptz not null, primary key ("id"));`);
    this.addSql(`create index "handoverLine_handoverId_index" on "handoverLine" ("handoverId");`);
    this.addSql(`create index "handoverLine_orderLineId_index" on "handoverLine" ("orderLineId");`);

    this.addSql(`create table "walletEntry" ("id" uuid not null default gen_random_uuid(), "memberId" uuid not null, "amountCents" int not null, "currency" varchar(255) not null default 'EUR', "reason" varchar(255) not null, "paymentMethod" varchar(255) null, "handoverId" uuid null, "recordedByUserId" uuid null, "note" varchar(255) null, "createdAt" timestamptz not null, primary key ("id"));`);
    this.addSql(`create index "walletEntry_memberId_index" on "walletEntry" ("memberId");`);
    this.addSql(`create index "walletEntry_handoverId_index" on "walletEntry" ("handoverId");`);

    this.addSql(`alter table "handover" add constraint "handover_orderId_foreign" foreign key ("orderId") references "order" ("id");`);
    this.addSql(`alter table "handover" add constraint "handover_memberId_foreign" foreign key ("memberId") references "member" ("id");`);
    this.addSql(`alter table "handover" add constraint "handover_reversesHandoverId_foreign" foreign key ("reversesHandoverId") references "handover" ("id") on delete set null;`);
    this.addSql(`alter table "handover" add constraint "handover_recordedByUserId_foreign" foreign key ("recordedByUserId") references "user" ("id");`);

    this.addSql(`alter table "handoverLine" add constraint "handoverLine_handoverId_foreign" foreign key ("handoverId") references "handover" ("id");`);
    this.addSql(`alter table "handoverLine" add constraint "handoverLine_orderLineId_foreign" foreign key ("orderLineId") references "orderLine" ("id");`);

    this.addSql(`alter table "walletEntry" add constraint "walletEntry_memberId_foreign" foreign key ("memberId") references "member" ("id");`);
    this.addSql(`alter table "walletEntry" add constraint "walletEntry_handoverId_foreign" foreign key ("handoverId") references "handover" ("id") on delete set null;`);
    this.addSql(`alter table "walletEntry" add constraint "walletEntry_recordedByUserId_foreign" foreign key ("recordedByUserId") references "user" ("id") on delete set null;`);

    this.addSql(`alter table "stockMovement" add "handoverLineId" uuid null;`);
    this.addSql(`alter table "stockMovement" add constraint "stockMovement_handoverLineId_foreign" foreign key ("handoverLineId") references "handoverLine" ("id") on delete set null;`);
    this.addSql(`create index "stockMovement_handoverLineId_index" on "stockMovement" ("handoverLineId");`);
  }

  override down(): void | Promise<void> {
    this.addSql(`alter table "handover" drop constraint "handover_reversesHandoverId_foreign";`);
    this.addSql(`alter table "handoverLine" drop constraint "handoverLine_handoverId_foreign";`);
    this.addSql(`alter table "walletEntry" drop constraint "walletEntry_handoverId_foreign";`);
    this.addSql(`alter table "stockMovement" drop constraint "stockMovement_handoverLineId_foreign";`);

    this.addSql(`drop table if exists "handover" cascade;`);
    this.addSql(`drop table if exists "handoverLine" cascade;`);
    this.addSql(`drop table if exists "walletEntry" cascade;`);

    this.addSql(`drop index "stockMovement_handoverLineId_index";`);
    this.addSql(`alter table "stockMovement" drop column "handoverLineId";`);
  }

}
