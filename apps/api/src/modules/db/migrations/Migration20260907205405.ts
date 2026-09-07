import { Migration } from '@mikro-orm/migrations'

export class Migration20260907205405 extends Migration {
  override up(): void | Promise<void> {
    this.addSql(
      `alter table "product" add "selectionUnit" varchar(255) null, add "quantityStepGrams" int null;`,
    )
  }

  override down(): void | Promise<void> {
    this.addSql(
      `alter table "product" drop column "selectionUnit", drop column "quantityStepGrams";`,
    )
  }
}
