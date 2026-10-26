CREATE TYPE "public"."tracked_link_source" AS ENUM('tracker', 'order', 'manual');--> statement-breakpoint
CREATE TABLE "tracked_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_user_id" text,
	"alert_email" text,
	"submission_id" uuid,
	"url" text NOT NULL,
	"target_domain" text NOT NULL,
	"expected_anchor" text,
	"source" "tracked_link_source" NOT NULL,
	"last_verdict" "link_verdict",
	"last_rel" text,
	"last_anchor" text,
	"last_status_code" integer,
	"last_checked_at" timestamp with time zone,
	"failures" integer DEFAULT 0 NOT NULL,
	"live_at" timestamp with time zone DEFAULT now() NOT NULL,
	"next_check_at" timestamp with time zone DEFAULT now() NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tracked_links_submission_id_unique" UNIQUE("submission_id")
);
--> statement-breakpoint
ALTER TABLE "link_checks" ALTER COLUMN "submission_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "link_checks" ADD COLUMN "tracked_link_id" uuid;--> statement-breakpoint
ALTER TABLE "submission_orders" ADD COLUMN "monitor_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "submission_orders" ADD COLUMN "monitor_ended_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "tracked_links" ADD CONSTRAINT "tracked_links_owner_user_id_user_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tracked_links" ADD CONSTRAINT "tracked_links_submission_id_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."submissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "tracked_links_due_idx" ON "tracked_links" USING btree ("active","next_check_at");--> statement-breakpoint
CREATE INDEX "tracked_links_owner_idx" ON "tracked_links" USING btree ("owner_user_id");--> statement-breakpoint
ALTER TABLE "link_checks" ADD CONSTRAINT "link_checks_tracked_link_id_tracked_links_id_fk" FOREIGN KEY ("tracked_link_id") REFERENCES "public"."tracked_links"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "link_checks_tracked_link_idx" ON "link_checks" USING btree ("tracked_link_id","checked_at");
--> statement-breakpoint
ALTER TABLE "tracked_links" ENABLE ROW LEVEL SECURITY;
