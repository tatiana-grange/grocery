import { Migration } from '@mikro-orm/migrations';

export class Migration20261123111139 extends Migration {

  override up(): void | Promise<void> {
    this.addSql(`alter table "walletEntry" add "correctsEntryId" uuid null;`);
    this.addSql(`alter table "walletEntry" add constraint "walletEntry_correctsEntryId_foreign" foreign key ("correctsEntryId") references "walletEntry" ("id") on delete set null;`);
    this.addSql(`alter table "walletEntry" add constraint "walletEntry_correctsEntryId_unique" unique ("correctsEntryId");`);
  }

  override down(): void | Promise<void> {
    this.addSql(`alter table "walletEntry" drop constraint "walletEntry_correctsEntryId_foreign";`);
    this.addSql(`alter table "walletEntry" drop constraint "walletEntry_correctsEntryId_unique";`);
    this.addSql(`alter table "walletEntry" drop column "correctsEntryId";`);
  }

}
