import { Migration } from '@mikro-orm/migrations'

export class Migration20261123130752 extends Migration {
  override up(): void | Promise<void> {
    this.addSql(`alter table "topup" add "underpaidNotifiedAt" timestamptz null;`)
  }

  override down(): void | Promise<void> {
    this.addSql(`alter table "topup" drop column "underpaidNotifiedAt";`)
  }
}
