CREATE TYPE "public"."post_kind" AS ENUM('post', 'recap');--> statement-breakpoint
CREATE TYPE "public"."post_status" AS ENUM('draft', 'published');--> statement-breakpoint
CREATE TABLE "posts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"excerpt" text DEFAULT '' NOT NULL,
	"body" text DEFAULT '' NOT NULL,
	"cover_url" text,
	"kind" "post_kind" DEFAULT 'post' NOT NULL,
	"week_key" text,
	"status" "post_status" DEFAULT 'draft' NOT NULL,
	"author_id" text,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "posts_slug_unique" UNIQUE("slug"),
	CONSTRAINT "posts_week_key_unique" UNIQUE("week_key")
);
--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_author_id_user_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "posts_published_idx" ON "posts" USING btree ("status","published_at");
--> statement-breakpoint
ALTER TABLE "posts" ENABLE ROW LEVEL SECURITY;