"use client";

import { useState, useTransition } from "react";
import { verifyBadgeAction } from "@/app/dashboard/actions";
import { CodeBlock } from "@/components/code-block";
import { Button } from "@/components/ui/button";

export function BadgePanel({
  productId,
  snippets,
  previewUrls,
  dnsHost,
  dnsValue,
  required,
}: {
  productId: string;
  snippets: { light: string; dark: string };
  previewUrls: { light: string; dark: string };
  dnsHost: string;
  dnsValue: string;
  required: boolean;
}) {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [copied, setCopied] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  function copy() {
    void navigator.clipboard.writeText(snippets[theme]).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  function verify() {
    setMessage(null);
    start(async () => {
      const res = await verifyBadgeAction(productId);
      setMessage({ ok: res.ok, text: res.message });
    });
  }

  return (
    <div className="space-y-3 text-sm">
      <p className="text-muted-foreground">
        {required
          ? "Paste this into your homepage or footer to keep a followed (dofollow) link from your listing."
          : "Optional for your plan, but it sends visitors to your listing."}{" "}
        Paste it as plain HTML: badges added by JavaScript can&apos;t be detected.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <span className={`max-w-full rounded-md p-2 ${theme === "dark" ? "bg-[#f3f7f5]" : "bg-[#dce6e2]"}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={previewUrls[theme]} alt="Badge preview" width={220} height={54} className="h-auto max-w-full" />
        </span>
        <div className="flex gap-1 text-xs">
          {(["light", "dark"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTheme(t)}
              className={`rounded px-2 py-1 ${theme === t ? "bg-foreground text-background" : "bg-muted"}`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>
      <CodeBlock code={snippets[theme]} copy={false} />
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="outline" onClick={copy}>
          {copied ? "Copied" : "Copy snippet"}
        </Button>
        <Button size="sm" onClick={verify} disabled={pending}>
          {pending ? "Checking…" : "Check my site"}
        </Button>
      </div>
      {message && <p className={message.ok ? "text-success" : "text-danger"}>{message.text}</p>}
      <details className="text-muted-foreground">
        <summary className="cursor-pointer">Site behind bot protection (e.g. Cloudflare)?</summary>
        <p className="mt-2">
          Keep the badge on your site and add this DNS TXT record to <code className="break-all">{dnsHost}</code>, then
          click “Check my site”:
        </p>
        <CodeBlock code={dnsValue} className="mt-2" />
      </details>
    </div>
  );
}
