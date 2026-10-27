CREATE TABLE "submission_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"submission_order_id" uuid NOT NULL,
	"to_address" text NOT NULL,
	"from_address" text NOT NULL,
	"subject" text DEFAULT '' NOT NULL,
	"text" text DEFAULT '' NOT NULL,
	"html" text,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "directories" ADD COLUMN "badge_snippet" text;--> statement-breakpoint
ALTER TABLE "submission_orders" ADD COLUMN "inbox_key" text;--> statement-breakpoint
ALTER TABLE "submission_orders" ADD COLUMN "badge_block_sent_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "submissions" ADD COLUMN "account_login" text;--> statement-breakpoint
ALTER TABLE "submissions" ADD COLUMN "account_secret" text;--> statement-breakpoint
ALTER TABLE "submissions" ADD COLUMN "badge_seen_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "submission_messages" ADD CONSTRAINT "submission_messages_submission_order_id_submission_orders_id_fk" FOREIGN KEY ("submission_order_id") REFERENCES "public"."submission_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "submission_messages_order_idx" ON "submission_messages" USING btree ("submission_order_id","received_at");--> statement-breakpoint
ALTER TABLE "submission_orders" ADD CONSTRAINT "submission_orders_inbox_key_unique" UNIQUE("inbox_key");--> statement-breakpoint
ALTER TABLE "submission_messages" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
UPDATE "submission_orders" SET "inbox_key" = substr(md5("id"::text), 1, 10) WHERE "inbox_key" IS NULL;
