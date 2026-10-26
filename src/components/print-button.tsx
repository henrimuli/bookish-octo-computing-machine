"use client";

import { Button } from "@/components/ui/button";

/** Opens the browser's print dialog; "Save as PDF" gives a PDF of the report. */
export function PrintButton({ label = "Download PDF" }: { label?: string }) {
  return (
    <Button variant="outline" size="sm" onClick={() => window.print()} className="print:hidden">
      {label}
    </Button>
  );
}
