-- RLS on the Phase 1 tables (blocks Supabase's Data API; the app bypasses it).
ALTER TABLE "launch_weeks" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "categories" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "products" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "product_categories" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "product_media" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "votes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "comments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "awards" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "badge_verifications" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "product_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "product_orders" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
-- Starting categories. Edit names/order freely; slugs are used in URLs.
INSERT INTO "categories" ("slug", "name", "description", "position") VALUES
  ('ai', 'AI', 'Tools built on or for AI models', 0),
  ('productivity', 'Productivity', '', 1),
  ('developer-tools', 'Developer Tools', '', 2),
  ('marketing', 'Marketing', '', 3),
  ('design', 'Design', '', 4),
  ('analytics', 'Analytics', '', 5),
  ('seo', 'SEO', '', 6),
  ('sales', 'Sales', '', 7),
  ('finance', 'Finance', '', 8),
  ('e-commerce', 'E-commerce', '', 9),
  ('education', 'Education', '', 10),
  ('writing', 'Writing & Content', '', 11),
  ('video', 'Video', '', 12),
  ('audio', 'Audio & Music', '', 13),
  ('image', 'Image', '', 14),
  ('social-media', 'Social Media', '', 15),
  ('communication', 'Communication', '', 16),
  ('customer-support', 'Customer Support', '', 17),
  ('hr', 'HR & Recruiting', '', 18),
  ('health', 'Health & Fitness', '', 19),
  ('no-code', 'No-Code', '', 20),
  ('open-source', 'Open Source', '', 21),
  ('security', 'Security', '', 22),
  ('devops', 'DevOps & Hosting', '', 23),
  ('data', 'Data & APIs', '', 24),
  ('automation', 'Automation', '', 25),
  ('browser-extensions', 'Browser Extensions', '', 26),
  ('mobile', 'Mobile Apps', '', 27),
  ('games', 'Games', '', 28),
  ('lifestyle', 'Lifestyle', '', 29),
  ('launch-platforms', 'Launch Platforms', 'Directories and launch boards', 30),
  ('other', 'Other', '', 31)
ON CONFLICT ("slug") DO NOTHING;
