import { Migration } from '@mikro-orm/migrations'

export class Migration20261124151128 extends Migration {
  override up(): void | Promise<void> {
    this.addSql(
      `create table "expense" ("id" uuid not null default gen_random_uuid(), "spentOn" date not null, "amountCents" int not null, "category" varchar(255) not null, "label" varchar(200) not null, "paymentMethod" varchar(255) not null, "kind" varchar(255) not null default 'expense', "cancelsExpenseId" uuid null, "reason" varchar(500) null, "recordedByUserId" uuid not null, "createdAt" timestamptz not null, primary key ("id"));`,
    )
    this.addSql(`create index "expense_spentOn_index" on "expense" ("spentOn");`)
    this.addSql(
      `alter table "expense" add constraint "expense_cancelsExpenseId_unique" unique ("cancelsExpenseId");`,
    )

    this.addSql(
      `alter table "expense" add constraint "expense_cancelsExpenseId_foreign" foreign key ("cancelsExpenseId") references "expense" ("id") on delete set null;`,
    )
    this.addSql(
      `alter table "expense" add constraint "expense_recordedByUserId_foreign" foreign key ("recordedByUserId") references "user" ("id");`,
    )
  }

  override down(): void | Promise<void> {
    this.addSql(`alter table "expense" drop constraint "expense_cancelsExpenseId_foreign";`)

    this.addSql(`drop table if exists "expense" cascade;`)
  }
}
