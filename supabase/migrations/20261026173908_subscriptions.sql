CREATE TABLE "plan_credits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"kind" text NOT NULL,
	"period_key" text NOT NULL,
	"target_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "past_due_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "dunning_stage" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "featured_product_id" uuid;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "synced_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "plan_credits" ADD CONSTRAINT "plan_credits_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "plan_credits_user_kind_period_idx" ON "plan_credits" USING btree ("user_id","kind","period_key");
--> statement-breakpoint
ALTER TABLE "plan_credits" ENABLE ROW LEVEL SECURITY;
