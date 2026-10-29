CREATE TABLE "spotlight_waitlist" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"product_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"notified_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "spotlight_waitlist" ADD CONSTRAINT "spotlight_waitlist_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "spotlight_waitlist" ADD CONSTRAINT "spotlight_waitlist_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "spotlight_waitlist_waiting_idx" ON "spotlight_waitlist" USING btree ("user_id") WHERE "spotlight_waitlist"."notified_at" is null;--> statement-breakpoint
ALTER TABLE "spotlight_waitlist" ENABLE ROW LEVEL SECURITY;