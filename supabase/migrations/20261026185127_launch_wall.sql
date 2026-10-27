CREATE TABLE "launch_wall_profiles" (
	"user_id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "launch_wall_profiles" ADD CONSTRAINT "launch_wall_profiles_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "launch_wall_profiles" ENABLE ROW LEVEL SECURITY;
