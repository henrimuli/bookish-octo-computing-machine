"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { logoUploadAction, prefillAction, saveProductAction } from "@/app/submit/actions";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/primitives";
import { MAX_CATEGORIES, type ProductInput } from "@/lib/products/input";
import { cn } from "@/lib/utils";

type Category = { slug: string; name: string };

const pricingOptions: Array<{ value: ProductInput["pricingModel"]; label: string }> = [
  { value: "free", label: "Free" },
  { value: "freemium", label: "Freemium" },
  { value: "trial", label: "Free trial" },
  { value: "paid", label: "Paid" },
  { value: "open_source", label: "Open source" },
];

const empty: ProductInput = {
  websiteUrl: "",
  name: "",
  tagline: "",
  description: "",
  logoUrl: "",
  categories: [],
  pricingModel: "freemium",
  twitterUrl: "",
  githubUrl: "",
};

export function ProductForm({
  categories,
  initial,
  productId,
  uploadsEnabled,
  initialWebsiteUrl,
}: {
  categories: Category[];
  initial?: ProductInput;
  productId?: string;
  uploadsEnabled: boolean;
  initialWebsiteUrl?: string;
}) {
  const router = useRouter();
  const [values, setValues] = useState<ProductInput>(
    initial ?? (initialWebsiteUrl ? { ...empty, websiteUrl: initialWebsiteUrl } : empty),
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [prefilling, startPrefill] = useTransition();
  const [saving, startSave] = useTransition();
  const [uploading, setUploading] = useState(false);

  const set = <K extends keyof ProductInput>(key: K, value: ProductInput[K]) =>
    setValues((v) => ({ ...v, [key]: value }));

  function prefill() {
    setMessage(null);
    startPrefill(async () => {
      const res = await prefillAction(values.websiteUrl);
      if (!res.ok) return setMessage(res.error);
      const d = res.data;
      setValues((v) => ({
        ...v,
        websiteUrl: d.url,
        name: v.name || d.name || "",
        tagline: v.tagline || d.tagline || "",
        description: v.description || d.description || "",
        logoUrl: v.logoUrl || d.logoUrl || "",
        twitterUrl: v.twitterUrl || d.twitterUrl || "",
      }));
      setMessage("We filled in what we could find. Check everything before continuing.");
    });
  }

  async function uploadLogo(file: File) {
    setUploading(true);
    setMessage(null);
    try {
      const res = await logoUploadAction(file.type, file.size);
      if (!res.ok) throw new Error(res.error);
      const put = await fetch(res.data.uploadUrl, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type },
      });
      if (!put.ok) throw new Error("Upload failed");
      set("logoUrl", res.data.publicUrl);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  function toggleCategory(slug: string) {
    setValues((v) => {
      const has = v.categories.includes(slug);
      if (!has && v.categories.length >= MAX_CATEGORIES) return v;
      return { ...v, categories: has ? v.categories.filter((c) => c !== slug) : [...v.categories, slug] };
    });
  }

  function save(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
    setMessage(null);
    startSave(async () => {
      const res = await saveProductAction(values, productId);
      if (!res.ok) {
        setErrors(res.fieldErrors ?? {});
        setMessage(res.error);
        return;
      }
      router.push(`/submit/${res.data.id}/plan`);
    });
  }

  const field = (key: keyof ProductInput) => errors[key] && <p className="text-sm text-danger">{errors[key]}</p>;

  return (
    <form onSubmit={save} className="space-y-8">
      <section className="space-y-2">
        <Label htmlFor="websiteUrl">Website</Label>
        <div className="flex gap-2">
          <Input
            id="websiteUrl"
            type="url"
            required
            placeholder="https://yourproduct.com"
            value={values.websiteUrl}
            onChange={(e) => set("websiteUrl", e.target.value)}
          />
          <Button type="button" variant="outline" onClick={prefill} disabled={!values.websiteUrl || prefilling}>
            {prefilling ? "Reading…" : "Fill from site"}
          </Button>
        </div>
        {field("websiteUrl")}
      </section>

      <section className="grid gap-6 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="name">Product name</Label>
          <Input id="name" required maxLength={60} value={values.name} onChange={(e) => set("name", e.target.value)} />
          {field("name")}
        </div>
        <div className="space-y-2">
          <Label htmlFor="pricingModel">Pricing</Label>
          <select
            id="pricingModel"
            className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm"
            value={values.pricingModel}
            onChange={(e) => set("pricingModel", e.target.value as ProductInput["pricingModel"])}
          >
            {pricingOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </section>

      <section className="space-y-2">
        <Label htmlFor="tagline">Tagline</Label>
        <Input
          id="tagline"
          required
          maxLength={80}
          placeholder="What it does, in one line"
          value={values.tagline}
          onChange={(e) => set("tagline", e.target.value)}
        />
        <p className="text-xs text-muted-foreground">{values.tagline.length}/80</p>
        {field("tagline")}
      </section>

      <section className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <textarea
          id="description"
          required
          rows={6}
          maxLength={2000}
          className="w-full rounded-md border border-border bg-card p-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          placeholder="Who it's for, the problem it solves, and what makes it different."
          value={values.description}
          onChange={(e) => set("description", e.target.value)}
        />
        {field("description")}
      </section>

      <section className="space-y-2">
        <Label htmlFor="logoUrl">Logo</Label>
        <div className="flex items-center gap-4">
          {values.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={values.logoUrl}
              alt=""
              className="size-14 rounded-md border border-border bg-card object-contain"
            />
          ) : (
            <div className="size-14 rounded-md border border-dashed border-border" />
          )}
          <div className="flex-1 space-y-2">
            <Input
              id="logoUrl"
              type="url"
              placeholder="https://… (square, at least 128px)"
              value={values.logoUrl ?? ""}
              onChange={(e) => set("logoUrl", e.target.value)}
            />
            {uploadsEnabled && (
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                disabled={uploading}
                onChange={(e) => e.target.files?.[0] && uploadLogo(e.target.files[0])}
                className="text-sm text-muted-foreground"
              />
            )}
          </div>
        </div>
        {field("logoUrl")}
      </section>

      <section className="space-y-2">
        <Label>Categories (up to {MAX_CATEGORIES})</Label>
        <div className="flex flex-wrap gap-2">
          {categories.map((c) => {
            const active = values.categories.includes(c.slug);
            return (
              <button
                key={c.slug}
                type="button"
                onClick={() => toggleCategory(c.slug)}
                className={cn(
                  "rounded-full border px-3 py-1 text-sm transition-colors",
                  active ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-muted",
                )}
                aria-pressed={active}
              >
                {c.name}
              </button>
            );
          })}
        </div>
        {field("categories")}
      </section>

      <section className="grid gap-6 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="twitterUrl">X / Twitter (optional)</Label>
          <Input
            id="twitterUrl"
            type="url"
            placeholder="https://x.com/yourhandle"
            value={values.twitterUrl ?? ""}
            onChange={(e) => set("twitterUrl", e.target.value)}
          />
          {field("twitterUrl")}
        </div>
        <div className="space-y-2">
          <Label htmlFor="githubUrl">GitHub (optional)</Label>
          <Input
            id="githubUrl"
            type="url"
            placeholder="https://github.com/you/repo"
            value={values.githubUrl ?? ""}
            onChange={(e) => set("githubUrl", e.target.value)}
          />
          {field("githubUrl")}
        </div>
      </section>

      {message && <p className="rounded-md bg-muted p-3 text-sm">{message}</p>}

      <Button type="submit" size="lg" disabled={saving || uploading}>
        {saving ? "Saving…" : "Continue to plan"}
      </Button>
    </form>
  );
}
