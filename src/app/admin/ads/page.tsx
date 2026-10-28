import type { Metadata } from "next";
import { Suspense } from "react";
import { BookingStatsTable } from "@/components/ads/booking-stats";
import { Heading } from "@/components/ui/primitives";
import { PLACEMENTS, PLACEMENT_IDS } from "@/lib/ads/placements";
import { allBookings, availability } from "@/lib/ads/service";
import { requireStaff } from "@/lib/auth";

export const metadata: Metadata = { title: "Ads · Admin", robots: { index: false } };

export default function AdsAdminPage() {
  return (
    <div className="mx-auto max-w-6xl">
      <Heading className="text-2xl sm:text-3xl">Ads</Heading>
      <Suspense fallback={<p className="mt-8 text-muted-foreground">Loading…</p>}>
        <Body />
      </Suspense>
    </div>
  );
}

async function Body() {
  await requireStaff();
  const placements = PLACEMENT_IDS.filter((p) => p !== "category");
  const [rows, ...calendars] = await Promise.all([allBookings(), ...placements.map((p) => availability(p, null))]);
  const weeks = calendars[0].slice(0, 8);
  return (
    <div className="mt-8 space-y-10">
      <section>
        <h2 className="font-display text-xl font-semibold">Inventory (slots left)</h2>
        <div className="mt-3 overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Placement</th>
                {weeks.map((w) => (
                  <th key={w.key} className="px-3 py-2 font-medium">
                    {w.key.slice(5)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {placements.map((p, i) => (
                <tr key={p}>
                  <td className="px-3 py-2">{PLACEMENTS[p].label}</td>
                  {weeks.map((w) => {
                    const left = calendars[i].find((c) => c.key === w.key)?.remaining;
                    return (
                      <td
                        key={w.key}
                        className={`px-3 py-2 text-center tabular-nums ${left === 0 ? "text-danger" : ""}`}
                      >
                        {left ?? "–"}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">Category sponsors are capped at one per category per week.</p>
      </section>
      <section>
        <h2 className="font-display text-xl font-semibold">Bookings</h2>
        {rows.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">No bookings yet.</p>
        ) : (
          <div className="mt-3">
            <BookingStatsTable rows={rows} showBuyer />
          </div>
        )}
      </section>
    </div>
  );
}
