"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { avatarUploadAction, saveProfileAction } from "@/app/dashboard/profile/actions";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { Input, Label, Spinner } from "@/components/ui/primitives";
import { BIO_MAX, type ProfileValues } from "@/lib/profile";

export function ProfileForm({ initial, uploadsEnabled }: { initial: ProfileValues; uploadsEnabled: boolean }) {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [values, setValues] = useState(initial);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);

  const set = (key: keyof ProfileValues, value: string) => setValues((v) => ({ ...v, [key]: value }));

  async function upload(file: File) {
    setUploading(true);
    setMessage(null);
    try {
      const res = await avatarUploadAction(file.type, file.size);
      if (!res.ok) throw new Error(res.error);
      const put = await fetch(res.data.uploadUrl, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type },
      });
      if (!put.ok) throw new Error("Upload failed");
      set("image", res.data.publicUrl);
    } catch (err) {
      setMessage({ text: err instanceof Error ? err.message : "Upload failed", error: true });
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    const res = await saveProfileAction(values);
    setSaving(false);
    if (!res.ok) return setMessage({ text: res.error, error: true });
    setMessage({ text: "Profile saved." });
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <div className="flex items-center gap-4">
        <Avatar name={values.name} src={values.image} className="size-20 text-2xl" />
        <div className="space-y-2">
          <p className="text-sm font-medium">Profile picture</p>
          <div className="flex flex-wrap gap-2">
            {uploadsEnabled && (
              <>
                <input
                  ref={fileInput}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  className="sr-only"
                  id="avatar-file"
                  onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={uploading}
                  onClick={() => fileInput.current?.click()}
                >
                  {uploading && <Spinner />}
                  {uploading ? "Uploading" : values.image ? "Change" : "Upload"}
                </Button>
              </>
            )}
            {values.image && (
              <Button type="button" variant="ghost" size="sm" disabled={uploading} onClick={() => set("image", "")}>
                Remove
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {uploadsEnabled ? "Square PNG, JPG or WebP, under 5 MB." : "Paste a link to a square image below."}
          </p>
        </div>
      </div>

      {!uploadsEnabled && (
        <div className="space-y-1.5">
          <Label htmlFor="image">Picture link</Label>
          <Input
            id="image"
            type="url"
            placeholder="https://…"
            value={values.image}
            onChange={(e) => set("image", e.target.value)}
          />
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="name">Name</Label>
        <Input id="name" required maxLength={60} value={values.name} onChange={(e) => set("name", e.target.value)} />
      </div>

      <div className="space-y-1.5">
        <div className="flex items-baseline justify-between">
          <Label htmlFor="bio">Short bio</Label>
          <span className="text-xs text-muted-foreground">
            {values.bio.length}/{BIO_MAX}
          </span>
        </div>
        <textarea
          id="bio"
          rows={3}
          maxLength={BIO_MAX}
          value={values.bio}
          onChange={(e) => set("bio", e.target.value)}
          placeholder="What you build and what you're working on."
          className="w-full resize-none rounded-md border border-border bg-card p-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="x">X</Label>
          <Input id="x" placeholder="@username" value={values.x} onChange={(e) => set("x", e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="github">GitHub</Label>
          <Input
            id="github"
            placeholder="username"
            value={values.github}
            onChange={(e) => set("github", e.target.value)}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t border-border pt-5">
        <Button type="submit" disabled={saving || uploading}>
          {saving && <Spinner />}
          {saving ? "Saving" : "Save profile"}
        </Button>
        {message && (
          <p role="status" className={message.error ? "text-sm text-danger" : "text-sm text-success"}>
            {message.text}
          </p>
        )}
      </div>
    </form>
  );
}
