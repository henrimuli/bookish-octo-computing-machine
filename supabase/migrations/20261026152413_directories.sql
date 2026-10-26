CREATE TYPE "public"."badge_preference" AS ENUM('none', 'allow');--> statement-breakpoint
CREATE TYPE "public"."directory_niche" AS ENUM('general', 'devtools', 'ai', 'indie', 'b2b');--> statement-breakpoint
CREATE TYPE "public"."directory_pricing" AS ENUM('free', 'freemium', 'paid');--> statement-breakpoint
CREATE TYPE "public"."link_type" AS ENUM('dofollow', 'nofollow', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."link_verdict" AS ENUM('dofollow', 'nofollow', 'missing', 'unreachable');--> statement-breakpoint
CREATE TYPE "public"."submission_order_status" AS ENUM('awaiting_intake', 'queued', 'in_progress', 'delivered', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."submission_package" AS ENUM('starter', 'growth', 'scale');--> statement-breakpoint
CREATE TYPE "public"."submission_status" AS ENUM('todo', 'submitted', 'pending', 'needs_action', 'live', 'rejected', 'replaced', 'skipped', 'dead');--> statement-breakpoint
CREATE TABLE "directories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"url" text NOT NULL,
	"submit_url" text,
	"description" text DEFAULT '' NOT NULL,
	"niche" "directory_niche" DEFAULT 'general' NOT NULL,
	"pricing" "directory_pricing" DEFAULT 'free' NOT NULL,
	"dr" integer,
	"link_type_claimed" "link_type" DEFAULT 'unknown' NOT NULL,
	"link_type_observed" "link_type" DEFAULT 'unknown' NOT NULL,
	"badge_required" boolean DEFAULT false NOT NULL,
	"needs_account" boolean DEFAULT true NOT NULL,
	"guided" boolean DEFAULT false NOT NULL,
	"queue_estimate_days" integer,
	"submission_notes" text DEFAULT '' NOT NULL,
	"instructions" text DEFAULT '' NOT NULL,
	"acceptance_rate" real,
	"avg_days_to_live" real,
	"live_count" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_audited_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "directories_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "link_checks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"submission_id" uuid NOT NULL,
	"checked_at" timestamp with time zone DEFAULT now() NOT NULL,
	"verdict" "link_verdict" NOT NULL,
	"http_status" integer,
	"rel" text,
	"anchor" text,
	"error" text
);
--> statement-breakpoint
CREATE TABLE "submission_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid,
	"user_id" text,
	"product_id" uuid,
	"email" text NOT NULL,
	"package" "submission_package" NOT NULL,
	"target_count" integer NOT NULL,
	"status" "submission_order_status" DEFAULT 'awaiting_intake' NOT NULL,
	"intake_token" text NOT NULL,
	"report_token" text NOT NULL,
	"product_name" text,
	"website_url" text,
	"tagline" text,
	"short_description" text,
	"long_description" text,
	"categories" text[] DEFAULT '{}' NOT NULL,
	"logo_url" text,
	"founder_name" text,
	"contact_email" text,
	"client_notes" text,
	"badge_preference" "badge_preference" DEFAULT 'none' NOT NULL,
	"allow_accounts" boolean DEFAULT false NOT NULL,
	"assignee_id" text,
	"due_at" timestamp with time zone,
	"intake_at" timestamp with time zone,
	"started_at" timestamp with time zone,
	"delivered_at" timestamp with time zone,
	"digest_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "submission_orders_order_id_unique" UNIQUE("order_id"),
	CONSTRAINT "submission_orders_intake_token_unique" UNIQUE("intake_token"),
	CONSTRAINT "submission_orders_report_token_unique" UNIQUE("report_token")
);
--> statement-breakpoint
CREATE TABLE "submissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"directory_id" uuid NOT NULL,
	"submission_order_id" uuid,
	"product_id" uuid,
	"status" "submission_status" DEFAULT 'todo' NOT NULL,
	"submitted_at" timestamp with time zone,
	"live_at" timestamp with time zone,
	"live_url" text,
	"notes" text DEFAULT '' NOT NULL,
	"action_needed" text,
	"evidence_url" text,
	"replaces_id" uuid,
	"link_verdict" "link_verdict",
	"link_rel" text,
	"link_anchor" text,
	"link_http_status" integer,
	"link_checked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "link_checks" ADD CONSTRAINT "link_checks_submission_id_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."submissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submission_orders" ADD CONSTRAINT "submission_orders_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submission_orders" ADD CONSTRAINT "submission_orders_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submission_orders" ADD CONSTRAINT "submission_orders_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submission_orders" ADD CONSTRAINT "submission_orders_assignee_id_user_id_fk" FOREIGN KEY ("assignee_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_directory_id_directories_id_fk" FOREIGN KEY ("directory_id") REFERENCES "public"."directories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_submission_order_id_submission_orders_id_fk" FOREIGN KEY ("submission_order_id") REFERENCES "public"."submission_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "directories_active_dr_idx" ON "directories" USING btree ("is_active","dr");--> statement-breakpoint
CREATE INDEX "link_checks_submission_idx" ON "link_checks" USING btree ("submission_id","checked_at");--> statement-breakpoint
CREATE INDEX "submission_orders_status_idx" ON "submission_orders" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "submissions_order_directory_idx" ON "submissions" USING btree ("submission_order_id","directory_id");--> statement-breakpoint
CREATE UNIQUE INDEX "submissions_product_directory_idx" ON "submissions" USING btree ("product_id","directory_id");--> statement-breakpoint
CREATE INDEX "submissions_status_idx" ON "submissions" USING btree ("status");