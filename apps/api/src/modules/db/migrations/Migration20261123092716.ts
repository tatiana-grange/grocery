import { Migration } from '@mikro-orm/migrations'

export class Migration20261123092716 extends Migration {
  override up(): void | Promise<void> {
    this.addSql(
      `create table "topup" ("id" uuid not null default gen_random_uuid(), "memberId" uuid not null, "amountCents" int not null, "currency" varchar(255) not null default 'EUR', "status" varchar(255) not null default 'pending', "providerRequestId" varchar(255) null, "redirectUrl" text null, "expiresAt" timestamptz not null, "providerPaymentId" varchar(255) null, "walletEntryId" uuid null, "paidAt" timestamptz null, "lastCheckedAt" timestamptz null, "createdAt" timestamptz not null, "updatedAt" timestamptz not null, primary key ("id"));`,
    )
    this.addSql(`create index "topup_memberId_index" on "topup" ("memberId");`)
    this.addSql(
      `alter table "topup" add constraint "topup_providerRequestId_unique" unique ("providerRequestId");`,
    )
    this.addSql(
      `alter table "topup" add constraint "topup_providerPaymentId_unique" unique ("providerPaymentId");`,
    )
    this.addSql(
      `alter table "topup" add constraint "topup_walletEntryId_unique" unique ("walletEntryId");`,
    )
    this.addSql(`create index "topup_status_createdAt_index" on "topup" ("status", "createdAt");`)

    this.addSql(
      `alter table "topup" add constraint "topup_memberId_foreign" foreign key ("memberId") references "member" ("id");`,
    )
    this.addSql(
      `alter table "topup" add constraint "topup_walletEntryId_foreign" foreign key ("walletEntryId") references "walletEntry" ("id") on delete set null;`,
    )
  }

  override down(): void | Promise<void> {
    this.addSql(`drop table if exists "topup" cascade;`)
  }
}
