import { connection } from "next/server";
import { env } from "@/env";
import { site } from "@/config/site";
import { weekBoard } from "@/lib/board/queries";
import { addWeeks, formatWeekLabel, weekKeyFor } from "@/lib/weeks";

/** A plain-text map of the site for language models (https://llmstxt.org). */
export async function GET() {
  await connection();
  const base = env().NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  const current = weekKeyFor(new Date());
  const lines = [
    `# ${site.name}`,
    "",
    `> ${site.description}`,
    "",
    "## Key pages",
    `- [This week's debuts](${base}/): products launching this week, ranked by community votes`,
    `- [Past weeks](${base}/weeks): every weekly board, with final rankings`,
    `- [Categories](${base}/categories): products by category`,
    `- [How ranking works](${base}/how-ranking-works): scoring and anti-manipulation rules`,
    `- [Pricing](${base}/pricing): free and paid debuts, featured placements, directory submission service`,
    `- [Blog](${base}/blog): weekly recaps of every debut`,
    `- [Launch directories](${base}/directories): where to list a product after launch, with link types we've verified`,
    `- [Submission service](${base}/submission-service): we submit a product to 40–180 directories and verify every link`,
    `- [Launch readiness check](${base}/tools/launch-readiness): free pre-launch audit of any product URL`,
    "",
    "## For agents",
    `- [API & MCP docs](${base}/docs): MCP server at ${base}/api/mcp (search_products, get_product, list_categories, list_launch_directories, check_launch_readiness, submit_product drafts, get_my_launches)`,
    `- [OpenAPI spec](${base}/api/v1/openapi.json): REST API at ${base}/api/v1`,
    "",
  ];

  try {
    for (const key of [current, addWeeks(current, -1)]) {
      const board = await weekBoard(key);
      if (board.length === 0) continue;
      lines.push(`## ${formatWeekLabel(key)}`);
      for (const p of board.slice(0, 20)) lines.push(`- [${p.name}](${base}/p/${p.slug}): ${p.tagline}`);
      lines.push("");
    }
  } catch (err) {
    console.error("llms.txt: database unavailable", err);
  }

  return new Response(lines.join("\n"), {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=3600" },
  });
}
