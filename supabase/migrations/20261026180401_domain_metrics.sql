CREATE TABLE "domain_metrics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"domain" text NOT NULL,
	"dr" real NOT NULL,
	"referring_domains" integer,
	"provider" text NOT NULL,
	"measured_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "domain_metrics_domain_idx" ON "domain_metrics" USING btree ("domain","measured_at");
--> statement-breakpoint
ALTER TABLE "domain_metrics" ENABLE ROW LEVEL SECURITY;
