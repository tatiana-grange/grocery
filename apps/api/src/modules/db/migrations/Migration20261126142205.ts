import { Migration } from '@mikro-orm/migrations'

export class Migration20261126142205 extends Migration {
  override up(): void | Promise<void> {
    this.addSql(
      `alter table "supplier" add "scheduleEnabled" boolean not null default false, add "scheduleFrequency" text null, add "scheduleWeekParity" text null, add "scheduleMonthWeek" text null, add "scheduleDistributionWeekday" smallint null, add "scheduleSendingWeekday" smallint null, add "scheduleSendingHour" smallint null, add "scheduleActiveSince" timestamptz null, add "scheduleHandledDay" date null;`,
    )

    this.addSql(`alter table "supplierOrder" add "sentMode" text null, add "sentTo" text null;`)
  }

  override down(): void | Promise<void> {
    this.addSql(
      `alter table "supplier" drop column "scheduleEnabled", drop column "scheduleFrequency", drop column "scheduleWeekParity", drop column "scheduleMonthWeek", drop column "scheduleDistributionWeekday", drop column "scheduleSendingWeekday", drop column "scheduleSendingHour", drop column "scheduleActiveSince", drop column "scheduleHandledDay";`,
    )

    this.addSql(`alter table "supplierOrder" drop column "sentMode", drop column "sentTo";`)
  }
}
