CREATE TYPE "public"."perk_kind" AS ENUM('newsletter', 'newsletter_top', 'launch_post');--> statement-breakpoint
CREATE TYPE "public"."perk_status" AS ENUM('suggested', 'drafting', 'done', 'skipped');--> statement-breakpoint
ALTER TYPE "public"."post_kind" ADD VALUE 'launch';--> statement-breakpoint
CREATE TABLE "perk_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"order_id" uuid NOT NULL,
	"kind" "perk_kind" NOT NULL,
	"status" "perk_status" DEFAULT 'suggested' NOT NULL,
	"week_key" text NOT NULL,
	"blurb" text,
	"post_id" uuid,
	"skip_reason" text,
	"due_at" timestamp with time zone,
	"done_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "perk_tasks" ADD CONSTRAINT "perk_tasks_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "perk_tasks" ADD CONSTRAINT "perk_tasks_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "perk_tasks" ADD CONSTRAINT "perk_tasks_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "perk_tasks_order_kind_idx" ON "perk_tasks" USING btree ("order_id","kind");--> statement-breakpoint
CREATE INDEX "perk_tasks_status_kind_idx" ON "perk_tasks" USING btree ("status","kind");--> statement-breakpoint
CREATE INDEX "perk_tasks_product_idx" ON "perk_tasks" USING btree ("product_id");--> statement-breakpoint
ALTER TABLE "perk_tasks" ENABLE ROW LEVEL SECURITY;