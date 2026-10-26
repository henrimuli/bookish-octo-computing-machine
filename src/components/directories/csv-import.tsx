"use client";

import { useState, useTransition } from "react";
import { importCsvAction } from "@/app/admin/directories/actions";
import { Button } from "@/components/ui/button";

export function CsvImport() {
  const [text, setText] = useState("");
  const [result, setResult] = useState<Awaited<ReturnType<typeof importCsvAction>> | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="space-y-3">
      <input
        type="file"
        accept=".csv,text/csv"
        className="text-sm"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          if (f) setText(await f.text());
        }}
      />
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={5}
        placeholder={
          "name,url,dr,niche,pricing,link_type,badge_required,guided,queue_days,notes\nUneed,https://www.uneed.best,,general,freemium,dofollow,no,no,14,"
        }
        className="w-full rounded-md border border-border bg-card p-3 font-mono text-xs"
      />
      <div className="flex flex-wrap items-center gap-3">
        <Button
          onClick={() => start(async () => setResult(await importCsvAction(text)))}
          disabled={pending || !text.trim()}
        >
          {pending ? "Importing…" : "Import"}
        </Button>
        {result && (
          <p className="text-sm">
            {result.created} created, {result.updated} updated
            {result.errors.length > 0 && <span className="text-danger"> · {result.errors.length} errors</span>}
          </p>
        )}
      </div>
      {result && result.errors.length > 0 && (
        <ul className="list-disc pl-5 text-xs text-danger">
          {result.errors.slice(0, 20).map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
