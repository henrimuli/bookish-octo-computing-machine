-- Votes are now Applause: rename the table and everything named after it. No data changes.
ALTER TABLE "votes" RENAME TO "applause";--> statement-breakpoint
ALTER TABLE "applause" RENAME CONSTRAINT "votes_product_id_user_id_pk" TO "applause_product_id_user_id_pk";--> statement-breakpoint
ALTER TABLE "applause" RENAME CONSTRAINT "votes_product_id_products_id_fk" TO "applause_product_id_products_id_fk";--> statement-breakpoint
ALTER TABLE "applause" RENAME CONSTRAINT "votes_user_id_user_id_fk" TO "applause_user_id_user_id_fk";--> statement-breakpoint
ALTER INDEX "votes_user_created_idx" RENAME TO "applause_user_created_idx";--> statement-breakpoint
ALTER INDEX "votes_ip_created_idx" RENAME TO "applause_ip_created_idx";
