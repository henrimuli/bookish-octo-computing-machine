CREATE TYPE "public"."ad_placement" AS ENUM('leaderboard', 'home_rail', 'home_top', 'category', 'newsletter');--> statement-breakpoint
CREATE TYPE "public"."booking_status" AS ENUM('held', 'active', 'completed', 'cancelled');--> statement-breakpoint
CREATE TABLE "ad_bookings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"placement" "ad_placement" NOT NULL,
	"category_slug" text,
	"product_id" uuid NOT NULL,
	"user_id" text,
	"order_id" uuid,
	"sku" text NOT NULL,
	"week_key" text NOT NULL,
	"weeks" integer DEFAULT 1 NOT NULL,
	"status" "booking_status" DEFAULT 'held' NOT NULL,
	"held_until" timestamp with time zone,
	"starts_at" timestamp with time zone NOT NULL,
	"paid_ends_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"extensions" integer DEFAULT 0 NOT NULL,
	"impressions" integer DEFAULT 0 NOT NULL,
	"clicks" integer DEFAULT 0 NOT NULL,
	"settled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ad_bookings" ADD CONSTRAINT "ad_bookings_category_slug_categories_slug_fk" FOREIGN KEY ("category_slug") REFERENCES "public"."categories"("slug") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ad_bookings" ADD CONSTRAINT "ad_bookings_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ad_bookings" ADD CONSTRAINT "ad_bookings_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ad_bookings" ADD CONSTRAINT "ad_bookings_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ad_bookings_window_idx" ON "ad_bookings" USING btree ("placement","starts_at","ends_at");--> statement-breakpoint
CREATE INDEX "ad_bookings_user_idx" ON "ad_bookings" USING btree ("user_id");
--> statement-breakpoint
ALTER TABLE "ad_bookings" ENABLE ROW LEVEL SECURITY;