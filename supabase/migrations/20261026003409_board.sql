CREATE TYPE "public"."award_scope" AS ENUM('week', 'month', 'year');--> statement-breakpoint
CREATE TYPE "public"."badge_method" AS ENUM('html', 'dns');--> statement-breakpoint
CREATE TYPE "public"."badge_status" AS ENUM('unverified', 'verified', 'grace', 'missing');--> statement-breakpoint
CREATE TYPE "public"."comment_status" AS ENUM('visible', 'hidden', 'deleted');--> statement-breakpoint
CREATE TYPE "public"."event_kind" AS ENUM('view', 'outbound_click');--> statement-breakpoint
CREATE TYPE "public"."pricing_model" AS ENUM('free', 'freemium', 'paid', 'open_source', 'trial');--> statement-breakpoint
CREATE TYPE "public"."product_status" AS ENUM('draft', 'pending', 'approved', 'rejected', 'archived');--> statement-breakpoint
CREATE TYPE "public"."product_tier" AS ENUM('free', 'fast_track', 'pro', 'premium', 'spotlight');--> statement-breakpoint
CREATE TABLE "awards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"scope" "award_scope" NOT NULL,
	"period_key" text NOT NULL,
	"place" integer NOT NULL,
	"score" real NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "badge_verifications" (
	"product_id" uuid PRIMARY KEY NOT NULL,
	"status" "badge_status" DEFAULT 'unverified' NOT NULL,
	"method" "badge_method",
	"dns_token" text NOT NULL,
	"last_checked_at" timestamp with time zone,
	"last_seen_at" timestamp with time zone,
	"grace_until" timestamp with time zone,
	"failure_reason" text
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"slug" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"position" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"parent_id" uuid,
	"body" text NOT NULL,
	"status" "comment_status" DEFAULT 'visible' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "launch_weeks" (
	"key" text PRIMARY KEY NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"free_capacity" integer DEFAULT 30 NOT NULL,
	"closed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "product_categories" (
	"product_id" uuid NOT NULL,
	"category_slug" text NOT NULL,
	CONSTRAINT "product_categories_product_id_category_slug_pk" PRIMARY KEY("product_id","category_slug")
);
--> statement-breakpoint
CREATE TABLE "product_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"kind" "event_kind" NOT NULL,
	"referrer" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_media" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"url" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_orders" (
	"order_id" uuid PRIMARY KEY NOT NULL,
	"product_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"tagline" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"website_url" text NOT NULL,
	"domain" text NOT NULL,
	"logo_url" text,
	"pricing_model" "pricing_model" DEFAULT 'freemium' NOT NULL,
	"twitter_url" text,
	"github_url" text,
	"status" "product_status" DEFAULT 'draft' NOT NULL,
	"tier" "product_tier" DEFAULT 'free' NOT NULL,
	"requested_week_key" text,
	"launch_week_key" text,
	"rejection_reason" text,
	"is_winner" boolean DEFAULT false NOT NULL,
	"created_by" text NOT NULL,
	"submitted_at" timestamp with time zone,
	"approved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "products_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "votes" (
	"product_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"weight" real DEFAULT 1 NOT NULL,
	"ip_hash" text,
	"ua_hash" text,
	"flagged" boolean DEFAULT false NOT NULL,
	"flag_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "votes_product_id_user_id_pk" PRIMARY KEY("product_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "handle" text;--> statement-breakpoint
ALTER TABLE "awards" ADD CONSTRAINT "awards_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "badge_verifications" ADD CONSTRAINT "badge_verifications_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_categories" ADD CONSTRAINT "product_categories_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_categories" ADD CONSTRAINT "product_categories_category_slug_categories_slug_fk" FOREIGN KEY ("category_slug") REFERENCES "public"."categories"("slug") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_events" ADD CONSTRAINT "product_events_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_media" ADD CONSTRAINT "product_media_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_orders" ADD CONSTRAINT "product_orders_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_orders" ADD CONSTRAINT "product_orders_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_launch_week_key_launch_weeks_key_fk" FOREIGN KEY ("launch_week_key") REFERENCES "public"."launch_weeks"("key") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "votes" ADD CONSTRAINT "votes_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "votes" ADD CONSTRAINT "votes_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "awards_period_place_idx" ON "awards" USING btree ("scope","period_key","place");--> statement-breakpoint
CREATE INDEX "awards_product_idx" ON "awards" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "comments_product_idx" ON "comments" USING btree ("product_id","created_at");--> statement-breakpoint
CREATE INDEX "product_categories_cat_idx" ON "product_categories" USING btree ("category_slug");--> statement-breakpoint
CREATE INDEX "product_events_product_kind_idx" ON "product_events" USING btree ("product_id","kind","created_at");--> statement-breakpoint
CREATE INDEX "product_orders_product_idx" ON "product_orders" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "products_status_week_idx" ON "products" USING btree ("status","launch_week_key");--> statement-breakpoint
CREATE INDEX "products_created_by_idx" ON "products" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "products_domain_idx" ON "products" USING btree ("domain");--> statement-breakpoint
CREATE INDEX "votes_user_created_idx" ON "votes" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "votes_ip_created_idx" ON "votes" USING btree ("ip_hash","created_at");--> statement-breakpoint
ALTER TABLE "user" ADD CONSTRAINT "user_handle_unique" UNIQUE("handle");