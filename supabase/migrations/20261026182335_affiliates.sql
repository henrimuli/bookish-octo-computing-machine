CREATE TYPE "public"."affiliate_status" AS ENUM('active', 'suspended');--> statement-breakpoint
CREATE TYPE "public"."referral_status" AS ENUM('pending', 'approved', 'paid', 'void');--> statement-breakpoint
CREATE TABLE "affiliate_referrals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"affiliate_id" uuid NOT NULL,
	"order_id" uuid NOT NULL,
	"commission_cents" integer NOT NULL,
	"status" "referral_status" DEFAULT 'pending' NOT NULL,
	"approved_at" timestamp with time zone,
	"paid_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "affiliate_referrals_order_id_unique" UNIQUE("order_id")
);
--> statement-breakpoint
CREATE TABLE "affiliates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"code" text NOT NULL,
	"payout_email" text NOT NULL,
	"rate_pct" integer DEFAULT 30 NOT NULL,
	"status" "affiliate_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "affiliates_user_id_unique" UNIQUE("user_id"),
	CONSTRAINT "affiliates_code_unique" UNIQUE("code")
);
--> statement-breakpoint
ALTER TABLE "affiliate_referrals" ADD CONSTRAINT "affiliate_referrals_affiliate_id_affiliates_id_fk" FOREIGN KEY ("affiliate_id") REFERENCES "public"."affiliates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "affiliate_referrals" ADD CONSTRAINT "affiliate_referrals_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "affiliates" ADD CONSTRAINT "affiliates_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "affiliate_referrals_affiliate_idx" ON "affiliate_referrals" USING btree ("affiliate_id","status");
--> statement-breakpoint
ALTER TABLE "affiliates" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "affiliate_referrals" ENABLE ROW LEVEL SECURITY;
