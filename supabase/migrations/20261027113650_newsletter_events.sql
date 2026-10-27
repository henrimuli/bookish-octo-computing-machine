CREATE TABLE "newsletter_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"svix_id" text NOT NULL,
	"week_key" text NOT NULL,
	"type" text NOT NULL,
	"email" text NOT NULL,
	"link" text,
	"occurred_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "newsletter_events_svix_id_unique" UNIQUE("svix_id")
);
--> statement-breakpoint
ALTER TABLE "newsletter_events" ADD CONSTRAINT "newsletter_events_week_key_newsletter_issues_week_key_fk" FOREIGN KEY ("week_key") REFERENCES "public"."newsletter_issues"("week_key") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "newsletter_events_week_idx" ON "newsletter_events" USING btree ("week_key","type");--> statement-breakpoint
ALTER TABLE "newsletter_events" ENABLE ROW LEVEL SECURITY;
