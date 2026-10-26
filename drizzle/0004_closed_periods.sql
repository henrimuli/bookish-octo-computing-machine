CREATE TABLE "closed_periods" (
	"scope" "award_scope" NOT NULL,
	"key" text NOT NULL,
	"closed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "closed_periods_scope_key_pk" PRIMARY KEY("scope","key")
);
--> statement-breakpoint
ALTER TABLE "closed_periods" ENABLE ROW LEVEL SECURITY;
