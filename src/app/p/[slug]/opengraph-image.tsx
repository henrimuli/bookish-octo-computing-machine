import { ImageResponse } from "next/og";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";

export const alt = "Product on DebutYard";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const p = await db()
    .query.products.findFirst({
      where: eq(schema.products.slug, slug),
      columns: { name: true, tagline: true, status: true },
    })
    .catch(() => undefined);
  const name = p?.status === "approved" ? p.name : "DebutYard";
  const tagline = p?.status === "approved" ? p.tagline : "Where great products debut.";

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: 80,
        background: "#fbfaf7",
        color: "#17150f",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 36, fontWeight: 800 }}>
        <div style={{ width: 48, height: 48, borderRadius: 24, background: "#e4572e" }} />
        <span>
          Debut<span style={{ color: "#e4572e" }}>Yard</span>
        </span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <div style={{ fontSize: 84, fontWeight: 800, lineHeight: 1.05 }}>{name}</div>
        <div style={{ fontSize: 40, color: "#6b6658" }}>{tagline}</div>
      </div>
      <div style={{ fontSize: 28, color: "#6b6658" }}>Debuting this week · vote at debutyard.com</div>
    </div>,
    size,
  );
}
