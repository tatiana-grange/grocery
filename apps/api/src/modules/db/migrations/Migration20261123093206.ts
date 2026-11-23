import { Migration } from '@mikro-orm/migrations'

export class Migration20261123093206 extends Migration {
  override up(): void | Promise<void> {
    this.addSql(`alter table "walletEntry" add "providerPaymentId" varchar(255) null;`)
    this.addSql(
      `alter table "walletEntry" add constraint "walletEntry_providerPaymentId_unique" unique ("providerPaymentId");`,
    )
  }

  override down(): void | Promise<void> {
    this.addSql(`alter table "walletEntry" drop constraint "walletEntry_providerPaymentId_unique";`)
    this.addSql(`alter table "walletEntry" drop column "providerPaymentId";`)
  }
}
