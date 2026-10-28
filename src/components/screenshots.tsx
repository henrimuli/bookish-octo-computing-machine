"use client";

import { useRef, useState } from "react";
import { screenshotUploadAction } from "@/app/submit/actions";
import { Dialog } from "@/components/ui/dialog";
import { Label, Spinner } from "@/components/ui/primitives";
import { MAX_SCREENSHOTS } from "@/lib/products/input";
import { putToStorage } from "@/lib/upload";
import { cn } from "@/lib/utils";

const eye = "M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Zm10 3a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z";

function Glyph({ d, className }: { d: string; className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("size-4", className)}
    >
      <path d={d} />
    </svg>
  );
}

/** A screenshot at full size, over the page. */
function Lightbox({ src, onClose }: { src: string; onClose: () => void }) {
  return (
    <Dialog onClose={onClose} size="xl" label="Screenshot" className="overflow-hidden p-2 sm:p-3">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" className="max-h-[calc(100dvh-6rem)] w-full rounded-lg object-contain" />
    </Dialog>
  );
}

/**
 * Up to three listing screenshots. The first usually comes from the fetch
 * (`capturing` shows its placeholder); the rest are uploaded to R2. Each one
 * can be opened full size or removed.
 */
export function ScreenshotsField({
  value,
  onChange,
  capturing,
  uploadsEnabled,
  error,
}: {
  value: string[];
  /** Gets an updater, so a capture and uploads finishing in any order all land. */
  onChange: (update: (current: string[]) => string[]) => void;
  capturing: boolean;
  uploadsEnabled: boolean;
  error?: string;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  async function upload(file: File) {
    setUploading(true);
    setMessage(null);
    try {
      const res = await screenshotUploadAction(file.type, file.size);
      if (!res.ok) throw new Error(res.error);
      await putToStorage(res.data.uploadUrl, file);
      onChange((current) => [...current, res.data.publicUrl].slice(0, MAX_SCREENSHOTS));
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  const slots = Array.from({ length: MAX_SCREENSHOTS }, (_, i) => i);
  // The capture lands in the first free slot; uploads take the one after it.
  const pendingSlot = capturing ? value.length : -1;
  const uploadSlot = value.length + (capturing ? 1 : 0);

  return (
    <section className="space-y-2">
      <div className="flex items-baseline justify-between">
        <Label>Screenshots (up to {MAX_SCREENSHOTS})</Label>
        <span className="text-xs text-muted-foreground">
          {value.length}/{MAX_SCREENSHOTS}
        </span>
      </div>
      <input
        ref={fileInput}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
      />
      <div className="grid grid-cols-3 gap-3">
        {slots.map((i) => {
          const src = value[i];
          if (src) {
            return (
              <div
                key={src}
                className="group relative aspect-video overflow-hidden rounded-md border border-border bg-muted"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt={`Screenshot ${i + 1}`} className="size-full object-cover object-top" />
                <div className="absolute inset-x-1 top-1 flex justify-between">
                  <button
                    type="button"
                    onClick={() => setOpen(src)}
                    aria-label={`View screenshot ${i + 1}`}
                    title="View"
                    className="grid size-7 place-items-center rounded-md bg-black/60 text-white hover:bg-black/80"
                  >
                    <Glyph d={eye} />
                  </button>
                  <button
                    type="button"
                    onClick={() => onChange((current) => current.filter((u) => u !== src))}
                    aria-label={`Remove screenshot ${i + 1}`}
                    title="Remove"
                    className="grid size-7 place-items-center rounded-md bg-black/60 text-white hover:bg-black/80"
                  >
                    <Glyph d="M6 6l12 12M18 6 6 18" />
                  </button>
                </div>
              </div>
            );
          }
          if (i === pendingSlot) {
            return (
              <div
                key={`pending-${i}`}
                className="flex aspect-video flex-col items-center justify-center gap-1.5 rounded-md border border-border bg-muted/60 text-center text-xs text-muted-foreground"
              >
                <Spinner />
                Taking a screenshot…
              </div>
            );
          }
          const canUpload = uploadsEnabled && i === uploadSlot;
          return (
            <button
              key={`empty-${i}`}
              type="button"
              disabled={!canUpload || uploading}
              onClick={() => fileInput.current?.click()}
              className={cn(
                "flex aspect-video flex-col items-center justify-center gap-1 rounded-md border-2 border-dashed border-border text-xs text-muted-foreground",
                canUpload ? "hover:border-primary/50 hover:text-foreground" : "opacity-50",
              )}
            >
              {canUpload && uploading ? (
                <>
                  <Spinner />
                  Uploading…
                </>
              ) : (
                <>
                  <Glyph d="M12 5v14M5 12h14" className="size-5" />
                  {canUpload ? "Upload" : ""}
                </>
              )}
            </button>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground">
        {uploadsEnabled
          ? "PNG, JPG or WebP, under 5 MB. Shown in a row on your product page."
          : "Uploads aren't set up yet."}
      </p>
      {(message || error) && <p className="text-xs text-danger">{message ?? error}</p>}
      {open && <Lightbox src={open} onClose={() => setOpen(null)} />}
    </section>
  );
}

/** The product page's row of screenshots; each opens full size. */
export function ScreenshotGallery({ urls, name }: { urls: string[]; name: string }) {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <section aria-label="Screenshots">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {urls.map((src, i) => (
          <button
            key={src}
            type="button"
            onClick={() => setOpen(src)}
            className="group relative aspect-video overflow-hidden rounded-lg border border-border bg-muted"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src}
              alt={`${name} screenshot ${i + 1}`}
              loading="lazy"
              className="size-full object-cover object-top transition-transform group-hover:scale-[1.02]"
            />
            <span className="absolute right-2 top-2 grid size-7 place-items-center rounded-md bg-black/60 text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
              <Glyph d={eye} />
            </span>
          </button>
        ))}
      </div>
      {open && <Lightbox src={open} onClose={() => setOpen(null)} />}
    </section>
  );
}
