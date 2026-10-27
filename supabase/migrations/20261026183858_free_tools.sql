CREATE TABLE "tool_checks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tool" text NOT NULL,
	"target" text NOT NULL,
	"client_hash" text NOT NULL,
	"source" text DEFAULT 'web' NOT NULL,
	"user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tool_checks" ADD CONSTRAINT "tool_checks_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "tool_checks_client_idx" ON "tool_checks" USING btree ("tool","client_hash","created_at");
ALTER TABLE "tool_checks" ENABLE ROW LEVEL SECURITY;
