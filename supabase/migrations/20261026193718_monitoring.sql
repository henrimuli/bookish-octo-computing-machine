ALTER TABLE "directories" ADD COLUMN "audited_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "directories" ADD COLUMN "audit_failures" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "directories" ADD COLUMN "audit_error" text;--> statement-breakpoint
ALTER TABLE "link_checks" ADD COLUMN "evidence_url" text;--> statement-breakpoint
ALTER TABLE "tracked_links" ADD COLUMN "indexed" boolean;--> statement-breakpoint
ALTER TABLE "tracked_links" ADD COLUMN "indexed_checked_at" timestamp with time zone;