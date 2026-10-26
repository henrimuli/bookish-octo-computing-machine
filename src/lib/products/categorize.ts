/**
 * Suggests categories for a product from its own words. Pure keyword scoring:
 * phrases in the name, tagline and description count more than ones only in
 * page headings or meta keywords. Good enough to pre-tick boxes the maker
 * then checks; not a classifier.
 */

/** Category slug → phrases that point to it. Matched as whole words, case-insensitive. */
const KEYWORDS: Record<string, string[]> = {
  ai: [
    "ai",
    "artificial intelligence",
    "gpt",
    "llm",
    "llms",
    "chatgpt",
    "claude",
    "machine learning",
    "ai-powered",
    "agent",
    "agents",
    "copilot",
    "prompt",
    "prompts",
  ],
  productivity: [
    "productivity",
    "to-do",
    "todo",
    "task manager",
    "tasks",
    "notes",
    "calendar",
    "focus",
    "time tracking",
    "workflow",
    "organize",
    "habit",
  ],
  "developer-tools": [
    "developer",
    "developers",
    "api client",
    "sdk",
    "cli",
    "ide",
    "code",
    "coding",
    "debug",
    "debugging",
    "git",
    "github",
    "terminal",
    "programming",
    "code review",
  ],
  marketing: [
    "marketing",
    "campaign",
    "campaigns",
    "leads",
    "lead generation",
    "growth",
    "landing page",
    "email marketing",
    "newsletter",
    "audience",
    "outreach",
  ],
  design: [
    "design",
    "designer",
    "designers",
    "figma",
    "ui",
    "ux",
    "mockup",
    "mockups",
    "prototype",
    "wireframe",
    "icons",
    "fonts",
    "color palette",
  ],
  analytics: [
    "analytics",
    "dashboard",
    "dashboards",
    "metrics",
    "insights",
    "tracking",
    "reports",
    "reporting",
    "kpi",
    "kpis",
  ],
  seo: ["seo", "search engine", "backlinks", "backlink", "keyword research", "rankings", "serp", "domain rating"],
  sales: ["sales", "crm", "pipeline", "prospects", "prospecting", "cold email", "deals", "quotes", "proposals"],
  finance: [
    "finance",
    "invoice",
    "invoices",
    "invoicing",
    "accounting",
    "budget",
    "budgeting",
    "expenses",
    "payments",
    "payroll",
    "tax",
    "taxes",
    "bookkeeping",
  ],
  "e-commerce": [
    "e-commerce",
    "ecommerce",
    "shopify",
    "store",
    "online store",
    "checkout",
    "storefront",
    "dropshipping",
    "woocommerce",
  ],
  education: [
    "learn",
    "learning",
    "course",
    "courses",
    "students",
    "teachers",
    "education",
    "tutor",
    "quiz",
    "flashcards",
    "study",
  ],
  writing: [
    "writing",
    "writer",
    "writers",
    "blog",
    "blogging",
    "copywriting",
    "content",
    "articles",
    "grammar",
    "essay",
  ],
  video: ["video", "videos", "youtube", "editing videos", "screen recording", "subtitles", "streaming", "clips"],
  audio: ["audio", "music", "podcast", "podcasts", "sound", "voice", "transcription", "soundscapes"],
  image: ["image", "images", "photo", "photos", "background removal", "screenshot", "screenshots", "illustration"],
  "social-media": [
    "social media",
    "twitter",
    "x",
    "linkedin",
    "instagram",
    "tiktok",
    "posts",
    "scheduling posts",
    "reddit",
    "subreddits",
  ],
  communication: ["chat", "messaging", "team chat", "meetings", "video calls", "slack", "inbox", "email client"],
  "customer-support": [
    "customer support",
    "support tickets",
    "helpdesk",
    "help desk",
    "live chat",
    "knowledge base",
    "customer service",
    "chatbot",
  ],
  hr: [
    "hiring",
    "recruiting",
    "recruitment",
    "candidates",
    "job board",
    "jobs",
    "onboarding employees",
    "hr",
    "applicant",
  ],
  health: ["health", "fitness", "workout", "workouts", "meditation", "sleep", "nutrition", "wellness", "mental health"],
  "no-code": [
    "no-code",
    "nocode",
    "no code",
    "without code",
    "drag and drop",
    "drag-and-drop",
    "website builder",
    "app builder",
  ],
  "open-source": ["open source", "open-source", "self-hosted", "self-host", "mit license", "github stars"],
  security: [
    "security",
    "secure",
    "password",
    "passwords",
    "encryption",
    "privacy",
    "2fa",
    "vulnerability",
    "vulnerabilities",
    "compliance",
  ],
  devops: [
    "devops",
    "hosting",
    "deploy",
    "deployment",
    "deployments",
    "servers",
    "kubernetes",
    "docker",
    "uptime",
    "monitoring",
    "ci/cd",
    "infrastructure",
  ],
  data: [
    "data",
    "database",
    "databases",
    "postgres",
    "sql",
    "api",
    "apis",
    "spreadsheet",
    "spreadsheets",
    "scraping",
    "etl",
    "dataset",
  ],
  automation: ["automation", "automate", "automates", "automated", "zapier", "workflows", "bots", "integrations"],
  "browser-extensions": ["chrome extension", "browser extension", "extension", "firefox add-on", "safari extension"],
  mobile: ["ios", "android", "iphone", "mobile app", "app store", "google play"],
  games: ["game", "games", "gaming", "play", "puzzle", "multiplayer"],
  lifestyle: ["travel", "recipes", "cooking", "home", "pets", "parenting", "fashion", "dating"],
  "launch-platforms": [
    "launch platform",
    "product launch",
    "directory",
    "directories",
    "launch board",
    "startup directory",
  ],
};

/** Ambiguous single words that only count when another phrase for the same category matched too. */
const WEAK = new Set([
  "x",
  "play",
  "home",
  "content",
  "data",
  "code",
  "posts",
  "store",
  "design",
  "ui",
  "secure",
  "sound",
  "voice",
  "focus",
  "agent",
  "agents",
  "extension",
  "api",
]);

export type CategorizeInput = {
  name?: string;
  tagline?: string;
  description?: string;
  /** Lower-weight extra text: headings, meta keywords. */
  extra?: string;
};

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const patterns = Object.fromEntries(
  Object.entries(KEYWORDS).map(([slug, words]) => [
    slug,
    words.map((w) => ({ word: w, re: new RegExp(`(^|[^a-z0-9])${escape(w)}(?=$|[^a-z0-9])`, "i") })),
  ]),
);

/** Up to `max` category slugs, best match first. Only slugs in `allowed` (when given) are returned. */
export function suggestCategories(input: CategorizeInput, allowed?: Iterable<string>, max = 3): string[] {
  const strong = [input.name, input.tagline, input.description].filter(Boolean).join(" \n ").toLowerCase();
  const weak = (input.extra ?? "").toLowerCase();
  const allow = allowed ? new Set(allowed) : null;

  const scores: Array<[string, number]> = [];
  for (const [slug, list] of Object.entries(patterns)) {
    if (allow && !allow.has(slug)) continue;
    let score = 0;
    let solid = false;
    for (const { word, re } of list) {
      const inStrong = re.test(strong);
      const inWeak = !inStrong && re.test(weak);
      if (!inStrong && !inWeak) continue;
      // Multi-word phrases are more telling than single words.
      const weight = (inStrong ? 2 : 1) * (word.includes(" ") || word.includes("-") ? 1.5 : 1);
      score += weight;
      if (!WEAK.has(word)) solid = true;
    }
    if (score > 0 && solid) scores.push([slug, score]);
  }
  return scores
    .sort((a, b) => b[1] - a[1])
    .filter(([, s]) => s >= 2)
    .slice(0, max)
    .map(([slug]) => slug);
}
