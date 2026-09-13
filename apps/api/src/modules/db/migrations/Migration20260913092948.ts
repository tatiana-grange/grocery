import { Migration } from '@mikro-orm/migrations'

export class Migration20260913092948 extends Migration {
  override up(): void | Promise<void> {
    this.addSql(`alter table "order" add "isExpress" boolean not null default false;`)

    this.addSql(
      `alter table "handover" alter column "note" type varchar(500) using ("note"::varchar(500));`,
    )
    this.addSql(
      `alter table "walletEntry" alter column "note" type varchar(500) using ("note"::varchar(500));`,
    )
  }

  override down(): void | Promise<void> {
    this.addSql(`alter table "order" drop column "isExpress";`)

    this.addSql(
      `alter table "handover" alter column "note" type varchar(255) using ("note"::varchar(255));`,
    )
    this.addSql(
      `alter table "walletEntry" alter column "note" type varchar(255) using ("note"::varchar(255));`,
    )
  }
}
