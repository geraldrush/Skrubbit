"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Loader2, Plus, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";

import { categories } from "@/data/products";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface VariantDraft {
  size: string;
  sku: string;
  price: string;
}

const emptyVariant = (): VariantDraft => ({ size: "", sku: "", price: "" });

/** "Pine Gel 5L" -> "pine-gel-5l" */
function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function ProductForm() {
  const router = useRouter();

  const [name, setName] = React.useState("");
  const [slug, setSlug] = React.useState("");
  const [slugTouched, setSlugTouched] = React.useState(false);
  const [tagline, setTagline] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [category, setCategory] = React.useState("");
  const [featured, setFeatured] = React.useState(false);
  const [scents, setScents] = React.useState("");
  const [usage, setUsage] = React.useState("");
  const [variants, setVariants] = React.useState<VariantDraft[]>([emptyVariant()]);

  const [image, setImage] = React.useState("");
  const [uploading, setUploading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  // The slug is derived from the name until the user edits it themselves.
  const effectiveSlug = slugTouched ? slug : slugify(name);

  function updateVariant(i: number, patch: Partial<VariantDraft>) {
    setVariants((vs) => vs.map((v, idx) => (idx === i ? { ...v, ...patch } : v)));
  }

  async function uploadImage(file: File) {
    if (!effectiveSlug) {
      toast.error("Enter a product name first — the image is filed under its slug.");
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("slug", effectiveSlug);
      const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
      const data = (await res.json()) as { path?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Upload failed");
      setImage(data.path!);
      toast.success("Image uploaded");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/admin/products", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          slug: effectiveSlug,
          name,
          tagline,
          description,
          category,
          image,
          featured,
          // One per line, matching how they render as lists on the product page.
          scents: scents.split("\n").map((s) => s.trim()).filter(Boolean),
          usage: usage.split("\n").map((s) => s.trim()).filter(Boolean),
          variants: variants.map((v) => ({ ...v, price: Number(v.price) })),
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Could not save product");

      toast.success(`${name} added`);
      setName("");
      setSlug("");
      setSlugTouched(false);
      setTagline("");
      setDescription("");
      setCategory("");
      setFeatured(false);
      setScents("");
      setUsage("");
      setImage("");
      setVariants([emptyVariant()]);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save product");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-6 rounded-lg border p-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="name">Product name</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Pine Gel"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="slug">URL slug</Label>
          <Input
            id="slug"
            value={effectiveSlug}
            onChange={(e) => {
              setSlugTouched(true);
              setSlug(slugify(e.target.value));
            }}
            placeholder="pine-gel"
            required
          />
          <p className="text-xs text-muted-foreground">/shop/{effectiveSlug || "…"}</p>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="tagline">Tagline</Label>
        <Input
          id="tagline"
          value={tagline}
          onChange={(e) => setTagline(e.target.value)}
          placeholder="Fresh pine clean for every surface."
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
          placeholder="A thick, economical multi-purpose pine gel…"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="category">Category</Label>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger id="category">
              <SelectValue placeholder="Choose a category" />
            </SelectTrigger>
            <SelectContent>
              {categories.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-end pb-2">
          <label className="flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              checked={featured}
              onChange={(e) => setFeatured(e.target.checked)}
              className="h-4 w-4 rounded border-border"
            />
            Show on the homepage
          </label>
        </div>
      </div>

      {/* Image */}
      <div className="space-y-2">
        <Label htmlFor="image">Product image</Label>
        <div className="flex flex-wrap items-center gap-4">
          {image ? (
            <div className="relative h-24 w-24 shrink-0 rounded border bg-muted/30">
              <Image src={image} alt="" fill className="object-contain p-1" />
            </div>
          ) : null}
          <div className="space-y-1">
            <Input
              id="image"
              type="file"
              accept="image/webp,image/png,image/jpeg"
              disabled={uploading}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void uploadImage(f);
              }}
            />
            <p className="text-xs text-muted-foreground">
              {uploading ? (
                <span className="inline-flex items-center gap-1">
                  <Loader2 className="h-3 w-3 animate-spin" /> Uploading…
                </span>
              ) : (
                "WebP, PNG or JPEG, under 2 MB. Resize large photos before uploading."
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Variants */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>Sizes &amp; prices</Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setVariants((vs) => [...vs, emptyVariant()])}
          >
            <Plus className="mr-1 h-4 w-4" /> Add size
          </Button>
        </div>
        {variants.map((v, i) => (
          <div key={i} className="grid grid-cols-[1fr_1fr_1fr_auto] items-end gap-2">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Size</Label>
              <Input
                value={v.size}
                onChange={(e) => updateVariant(i, { size: e.target.value })}
                placeholder="5 L"
                required
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">SKU</Label>
              <Input
                value={v.sku}
                onChange={(e) => updateVariant(i, { sku: e.target.value })}
                placeholder="PG-5L"
                required
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Price (R)</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={v.price}
                onChange={(e) => updateVariant(i, { price: e.target.value })}
                placeholder="94.90"
                required
              />
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              disabled={variants.length === 1}
              onClick={() => setVariants((vs) => vs.filter((_, idx) => idx !== i))}
              aria-label={`Remove size ${i + 1}`}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="scents">Scents — one per line</Label>
          <Textarea
            id="scents"
            value={scents}
            onChange={(e) => setScents(e.target.value)}
            rows={3}
            placeholder={"Pine\nLavender\nOcean"}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="usage">How to use — one per line</Label>
          <Textarea
            id="usage"
            value={usage}
            onChange={(e) => setUsage(e.target.value)}
            rows={3}
            placeholder={"Dilute in a bucket of water to mop floors.\nUse neat on tough stains."}
          />
        </div>
      </div>

      <Button type="submit" disabled={saving || uploading} className="w-full sm:w-auto">
        {saving ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving…
          </>
        ) : (
          <>
            <Upload className="mr-2 h-4 w-4" /> Add product
          </>
        )}
      </Button>
    </form>
  );
}
