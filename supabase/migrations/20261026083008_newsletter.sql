CREATE TYPE "public"."subscriber_status" AS ENUM('pending', 'active', 'unsubscribed');--> statement-breakpoint
CREATE TABLE "newsletter_issues" (
	"week_key" text PRIMARY KEY NOT NULL,
	"subject" text NOT NULL,
	"recipients" integer DEFAULT 0 NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sent_at" timestamp with time zone,
	"error" text
);
--> statement-breakpoint
CREATE TABLE "newsletter_subscribers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"status" "subscriber_status" DEFAULT 'pending' NOT NULL,
	"token" text NOT NULL,
	"source" text,
	"confirm_email_sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"confirmed_at" timestamp with time zone,
	"unsubscribed_at" timestamp with time zone,
	CONSTRAINT "newsletter_subscribers_email_unique" UNIQUE("email"),
	CONSTRAINT "newsletter_subscribers_token_unique" UNIQUE("token")
);
--> statement-breakpoint
ALTER TABLE "newsletter_subscribers" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "newsletter_issues" ENABLE ROW LEVEL SECURITY;
