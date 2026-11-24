import { Migration } from '@mikro-orm/migrations'

export class Migration20261124093029 extends Migration {
  override up(): void | Promise<void> {
    this.addSql(
      `create table "slot" ("id" uuid not null default gen_random_uuid(), "roleLabel" varchar(120) not null, "startsAt" timestamptz not null, "endsAt" timestamptz not null, "places" int not null, "cancelledAt" timestamptz null, "createdAt" timestamptz not null, "updatedAt" timestamptz not null, primary key ("id"));`,
    )
    this.addSql(`create index "slot_startsAt_index" on "slot" ("startsAt");`)

    this.addSql(
      `create table "slotSignup" ("id" uuid not null default gen_random_uuid(), "slotId" uuid not null, "memberId" uuid not null, "createdAt" timestamptz not null, primary key ("id"));`,
    )
    this.addSql(`create index "slotSignup_slotId_index" on "slotSignup" ("slotId");`)
    this.addSql(`create index "slotSignup_memberId_index" on "slotSignup" ("memberId");`)
    this.addSql(
      `alter table "slotSignup" add constraint "slotSignup_slotId_memberId_unique" unique ("slotId", "memberId");`,
    )

    this.addSql(
      `alter table "slotSignup" add constraint "slotSignup_slotId_foreign" foreign key ("slotId") references "slot" ("id");`,
    )
    this.addSql(
      `alter table "slotSignup" add constraint "slotSignup_memberId_foreign" foreign key ("memberId") references "member" ("id");`,
    )
  }

  override down(): void | Promise<void> {
    this.addSql(`alter table "slotSignup" drop constraint "slotSignup_slotId_foreign";`)

    this.addSql(`drop table if exists "slot" cascade;`)
    this.addSql(`drop table if exists "slotSignup" cascade;`)
  }
}
