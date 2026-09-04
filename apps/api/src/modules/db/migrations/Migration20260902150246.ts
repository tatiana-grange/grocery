import { Migration } from '@mikro-orm/migrations'

export class Migration20260902150246 extends Migration {
  override up(): void | Promise<void> {
    this.addSql(`alter table "comment" drop constraint "comment_parentId_foreign";`)
    this.addSql(`alter table "comment" drop constraint "comment_postId_foreign";`)
    this.addSql(`alter table "postVersion" drop constraint "postVersion_postId_foreign";`)
    this.addSql(`alter table "post_tag" drop constraint "post_tag_post_foreign";`)
    this.addSql(`alter table "post_tag" drop constraint "post_tag_tag_foreign";`)

    this.addSql(`drop table if exists "comment" cascade;`)
    this.addSql(`drop table if exists "post" cascade;`)
    this.addSql(`drop table if exists "postVersion" cascade;`)
    this.addSql(`drop table if exists "post_tag" cascade;`)
    this.addSql(`drop table if exists "tag" cascade;`)
  }

  override down(): void | Promise<void> {
    this.addSql(
      `create table "comment" ("authorName" varchar(255) null, "content" varchar(255) not null, "createdAt" timestamptz(6) not null, "id" uuid not null default gen_random_uuid(), "parentId" uuid null, "postId" uuid not null, "userId" uuid null, primary key ("id"));`,
    )
    this.addSql(`CREATE INDEX "comment_parentId_index" ON public.comment USING btree ("parentId");`)
    this.addSql(`CREATE INDEX "comment_postId_index" ON public.comment USING btree ("postId");`)
    this.addSql(`CREATE INDEX "comment_userId_index" ON public.comment USING btree ("userId");`)

    this.addSql(
      `create table "post" ("coverImage" varchar(255) null, "createdAt" timestamptz(6) not null, "id" uuid not null default gen_random_uuid(), "likesCount" int not null default 0, "publishedAt" timestamptz(6) null, "slug" varchar(255) null, "updatedAt" timestamptz(6) not null, "userId" uuid not null, primary key ("id"));`,
    )
    this.addSql(`CREATE INDEX "post_publishedAt_index" ON public.post USING btree ("publishedAt");`)
    this.addSql(`create index "post_slug_index" on "post" ("slug");`)
    this.addSql(`alter table "post" add constraint "post_slug_unique" unique ("slug");`)
    this.addSql(`CREATE INDEX "post_userId_index" ON public.post USING btree ("userId");`)

    this.addSql(
      `create table "postVersion" ("content" jsonb null, "createdAt" timestamptz(6) not null, "id" uuid not null default gen_random_uuid(), "postId" uuid not null, "title" varchar(255) not null, primary key ("id"));`,
    )
    this.addSql(`create index "postVersion_title_index" on "postVersion" ("title");`)

    this.addSql(
      `create table "post_tag" ("post" uuid not null, "tag" uuid not null, primary key ("post", "tag"));`,
    )

    this.addSql(
      `create table "tag" ("id" uuid not null default gen_random_uuid(), "name" varchar(255) not null, "slug" varchar(255) not null, primary key ("id"));`,
    )
    this.addSql(`create index "tag_name_index" on "tag" ("name");`)
    this.addSql(`alter table "tag" add constraint "tag_name_unique" unique ("name");`)
    this.addSql(`create index "tag_slug_index" on "tag" ("slug");`)
    this.addSql(`alter table "tag" add constraint "tag_slug_unique" unique ("slug");`)

    this.addSql(
      `alter table "comment" add constraint "comment_parentId_foreign" foreign key ("parentId") references "comment" ("id") on update cascade on delete set null;`,
    )
    this.addSql(
      `alter table "comment" add constraint "comment_postId_foreign" foreign key ("postId") references "post" ("id") on update cascade;`,
    )
    this.addSql(
      `alter table "comment" add constraint "comment_userId_foreign" foreign key ("userId") references "user" ("id") on update cascade on delete set null;`,
    )

    this.addSql(
      `alter table "post" add constraint "post_userId_foreign" foreign key ("userId") references "user" ("id") on update cascade;`,
    )

    this.addSql(
      `alter table "postVersion" add constraint "postVersion_postId_foreign" foreign key ("postId") references "post" ("id") on update cascade;`,
    )

    this.addSql(
      `alter table "post_tag" add constraint "post_tag_post_foreign" foreign key ("post") references "post" ("id") on update cascade on delete cascade;`,
    )
    this.addSql(
      `alter table "post_tag" add constraint "post_tag_tag_foreign" foreign key ("tag") references "tag" ("id") on update cascade on delete cascade;`,
    )
  }
}
