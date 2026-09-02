import { Migration } from '@mikro-orm/migrations';

/**
 * Lot 1 (Foundation): members, access roles, and the catalogue.
 *
 * Trimmed to the lot-1 additions only. The generator also emitted unrelated
 * DROP/ADD churn on the example `post` / `comment` / `account` foreign keys and a
 * `postVersion.content SET NOT NULL` (pre-existing snapshot drift, risky on existing
 * data) — those were removed by hand.
 */
export class Migration20260902085529 extends Migration {

  override up(): void | Promise<void> {
    // --- auth: role and phone-number plugin fields -------------------------------------------
    this.addSql(`alter table "user" add "role" varchar(255) null, add "banned" boolean not null default false, add "banReason" varchar(255) null, add "banExpires" timestamptz null, add "phoneNumber" varchar(255) null, add "phoneNumberVerified" boolean null;`);
    this.addSql(`alter table "user" add constraint "user_phoneNumber_unique" unique ("phoneNumber");`);
    this.addSql(`alter table "session" add "impersonatedBy" varchar(255) null;`);

    // --- members --------------------------------------------------------------------------------
    this.addSql(`create table "member" ("id" uuid not null default gen_random_uuid(), "userId" uuid not null, "membershipNumber" varchar(255) not null, "status" varchar(255) not null default 'pending', "addressLine1" varchar(255) null, "addressLine2" varchar(255) null, "postalCode" varchar(255) null, "city" varchar(255) null, "phone" varchar(255) null, "joinedAt" timestamptz null, "version" int not null default 1, "createdAt" timestamptz not null, "updatedAt" timestamptz not null, primary key ("id"));`);
    this.addSql(`create index "member_userId_index" on "member" ("userId");`);
    this.addSql(`alter table "member" add constraint "member_userId_unique" unique ("userId");`);
    this.addSql(`create index "member_membershipNumber_index" on "member" ("membershipNumber");`);
    this.addSql(`alter table "member" add constraint "member_membershipNumber_unique" unique ("membershipNumber");`);

    this.addSql(`create table "memberStatusChange" ("id" uuid not null default gen_random_uuid(), "memberId" uuid not null, "fromStatus" varchar(255) null, "toStatus" varchar(255) not null, "reason" varchar(255) null, "changedByUserId" uuid null, "createdAt" timestamptz not null, primary key ("id"));`);
    this.addSql(`create index "memberStatusChange_memberId_index" on "memberStatusChange" ("memberId");`);

    this.addSql(`create table "membershipFee" ("id" uuid not null default gen_random_uuid(), "memberId" uuid not null, "expectedAmountCents" int not null default 0, "version" int not null default 1, "createdAt" timestamptz not null, "updatedAt" timestamptz not null, primary key ("id"));`);
    this.addSql(`alter table "membershipFee" add constraint "membershipFee_memberId_unique" unique ("memberId");`);

    this.addSql(`create table "membershipPayment" ("id" uuid not null default gen_random_uuid(), "feeId" uuid not null, "kind" varchar(255) not null default 'payment', "amountCents" int not null, "method" varchar(255) not null, "paidAt" timestamptz not null, "note" varchar(255) null, "recordedByUserId" uuid not null, "createdAt" timestamptz not null, primary key ("id"));`);
    this.addSql(`create index "membershipPayment_feeId_index" on "membershipPayment" ("feeId");`);

    this.addSql(`create table "membershipIntakeSetting" ("id" uuid not null default gen_random_uuid(), "open" boolean not null default true, "createdAt" timestamptz not null, "updatedAt" timestamptz not null, primary key ("id"));`);

    this.addSql(`alter table "member" add constraint "member_userId_foreign" foreign key ("userId") references "user" ("id");`);
    this.addSql(`alter table "memberStatusChange" add constraint "memberStatusChange_memberId_foreign" foreign key ("memberId") references "member" ("id");`);
    this.addSql(`alter table "memberStatusChange" add constraint "memberStatusChange_changedByUserId_foreign" foreign key ("changedByUserId") references "user" ("id") on delete set null;`);
    this.addSql(`alter table "membershipFee" add constraint "membershipFee_memberId_foreign" foreign key ("memberId") references "member" ("id");`);
    this.addSql(`alter table "membershipPayment" add constraint "membershipPayment_feeId_foreign" foreign key ("feeId") references "membershipFee" ("id");`);
    this.addSql(`alter table "membershipPayment" add constraint "membershipPayment_recordedByUserId_foreign" foreign key ("recordedByUserId") references "user" ("id");`);

    // --- catalogue -----------------------------------------------------------------------------
    this.addSql(`create table "category" ("id" uuid not null default gen_random_uuid(), "name" varchar(255) not null, "parentId" uuid null, "archivedAt" timestamptz null, "version" int not null default 1, "createdAt" timestamptz not null, "updatedAt" timestamptz not null, primary key ("id"));`);
    this.addSql(`create index "category_name_index" on "category" ("name");`);
    this.addSql(`create index "category_archivedAt_index" on "category" ("archivedAt");`);

    this.addSql(`create table "supplier" ("id" uuid not null default gen_random_uuid(), "name" varchar(255) not null, "type" varchar(255) not null default 'producer', "contactName" varchar(255) null, "contactEmail" varchar(255) null, "contactPhone" varchar(255) null, "notes" varchar(255) null, "archivedAt" timestamptz null, "version" int not null default 1, "createdAt" timestamptz not null, "updatedAt" timestamptz not null, primary key ("id"));`);
    this.addSql(`create index "supplier_name_index" on "supplier" ("name");`);
    this.addSql(`create index "supplier_archivedAt_index" on "supplier" ("archivedAt");`);

    this.addSql(`create table "product" ("id" uuid not null default gen_random_uuid(), "name" varchar(255) not null, "description" varchar(255) null, "supplierId" uuid not null, "categoryId" uuid not null, "saleMode" varchar(255) not null default 'unit', "photos" text[] not null, "labels" text[] not null, "barcode" varchar(255) null, "averageWeightGrams" int null, "weightTolerancePercent" int null, "archivedAt" timestamptz null, "version" int not null default 1, "createdAt" timestamptz not null, "updatedAt" timestamptz not null, primary key ("id"));`);
    this.addSql(`create index "product_name_index" on "product" ("name");`);
    this.addSql(`create index "product_supplierId_index" on "product" ("supplierId");`);
    this.addSql(`create index "product_categoryId_index" on "product" ("categoryId");`);
    this.addSql(`alter table "product" add constraint "product_barcode_unique" unique ("barcode");`);
    this.addSql(`create index "product_archivedAt_index" on "product" ("archivedAt");`);

    this.addSql(`create table "productPrice" ("id" uuid not null default gen_random_uuid(), "productId" uuid not null, "amountCents" int not null, "currency" varchar(255) not null default 'EUR', "validFrom" timestamptz not null, "validTo" timestamptz null, "setByUserId" uuid not null, "createdAt" timestamptz not null, primary key ("id"));`);
    this.addSql(`create index "productPrice_productId_validTo_index" on "productPrice" ("productId", "validTo");`);

    this.addSql(`alter table "category" add constraint "category_parentId_foreign" foreign key ("parentId") references "category" ("id") on delete set null;`);
    this.addSql(`alter table "product" add constraint "product_supplierId_foreign" foreign key ("supplierId") references "supplier" ("id");`);
    this.addSql(`alter table "product" add constraint "product_categoryId_foreign" foreign key ("categoryId") references "category" ("id");`);
    this.addSql(`alter table "productPrice" add constraint "productPrice_productId_foreign" foreign key ("productId") references "product" ("id");`);
    this.addSql(`alter table "productPrice" add constraint "productPrice_setByUserId_foreign" foreign key ("setByUserId") references "user" ("id");`);
  }

  override down(): void | Promise<void> {
    this.addSql(`drop table if exists "productPrice" cascade;`);
    this.addSql(`drop table if exists "product" cascade;`);
    this.addSql(`drop table if exists "supplier" cascade;`);
    this.addSql(`drop table if exists "category" cascade;`);
    this.addSql(`drop table if exists "membershipPayment" cascade;`);
    this.addSql(`drop table if exists "membershipFee" cascade;`);
    this.addSql(`drop table if exists "memberStatusChange" cascade;`);
    this.addSql(`drop table if exists "member" cascade;`);
    this.addSql(`drop table if exists "membershipIntakeSetting" cascade;`);

    this.addSql(`alter table "session" drop column "impersonatedBy";`);
    this.addSql(`alter table "user" drop constraint "user_phoneNumber_unique";`);
    this.addSql(`alter table "user" drop column "role", drop column "banned", drop column "banReason", drop column "banExpires", drop column "phoneNumber", drop column "phoneNumberVerified";`);
  }

}
