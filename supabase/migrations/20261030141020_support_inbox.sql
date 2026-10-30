CREATE TYPE "public"."support_direction" AS ENUM('in', 'out');--> statement-breakpoint
CREATE TYPE "public"."support_status" AS ENUM('open', 'done', 'spam', 'trash');--> statement-breakpoint
CREATE TABLE "support_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"thread_id" uuid NOT NULL,
	"direction" "support_direction" NOT NULL,
	"from_address" text NOT NULL,
	"from_name" text,
	"to_addresses" text[] DEFAULT '{}' NOT NULL,
	"cc_addresses" text[] DEFAULT '{}' NOT NULL,
	"subject" text DEFAULT '' NOT NULL,
	"text" text DEFAULT '' NOT NULL,
	"html" text,
	"message_id" text,
	"in_reply_to" text,
	"references" text,
	"attachments" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"resend_email_id" text,
	"author_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "support_messages_resend_email_id_unique" UNIQUE("resend_email_id")
);
--> statement-breakpoint
CREATE TABLE "support_threads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reply_key" text NOT NULL,
	"subject" text DEFAULT '' NOT NULL,
	"contact_email" text NOT NULL,
	"contact_name" text,
	"status" "support_status" DEFAULT 'open' NOT NULL,
	"starred" boolean DEFAULT false NOT NULL,
	"unread" boolean DEFAULT true NOT NULL,
	"assignee_id" text,
	"snippet" text DEFAULT '' NOT NULL,
	"message_count" integer DEFAULT 0 NOT NULL,
	"last_message_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "support_threads_reply_key_unique" UNIQUE("reply_key")
);
--> statement-breakpoint
ALTER TABLE "support_messages" ADD CONSTRAINT "support_messages_thread_id_support_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."support_threads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_messages" ADD CONSTRAINT "support_messages_author_id_user_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_threads" ADD CONSTRAINT "support_threads_assignee_id_user_id_fk" FOREIGN KEY ("assignee_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "support_messages_thread_idx" ON "support_messages" USING btree ("thread_id","created_at");--> statement-breakpoint
CREATE INDEX "support_messages_message_id_idx" ON "support_messages" USING btree ("message_id");--> statement-breakpoint
CREATE INDEX "support_threads_status_idx" ON "support_threads" USING btree ("status","last_message_at");--> statement-breakpoint
CREATE INDEX "support_threads_contact_idx" ON "support_threads" USING btree ("contact_email");--> statement-breakpoint
ALTER TABLE "support_threads" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "support_messages" ENABLE ROW LEVEL SECURITY;
