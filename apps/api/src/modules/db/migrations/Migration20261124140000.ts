import { Migration } from '@mikro-orm/migrations'

export class Migration20261124140000 extends Migration {
  override up(): void | Promise<void> {
    this.addSql(`alter table "slotSignup" add column "updatedAt" timestamptz null;`)
    this.addSql(`update "slotSignup" set "updatedAt" = "createdAt";`)
    this.addSql(`alter table "slotSignup" alter column "updatedAt" set not null;`)
  }

  override down(): void | Promise<void> {
    this.addSql(`alter table "slotSignup" drop column "updatedAt";`)
  }
}
