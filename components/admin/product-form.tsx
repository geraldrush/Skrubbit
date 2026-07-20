"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Loader2, Plus, Save, Trash2, Upload, X } from "lucide-react";
import { toast } from "sonner";

import { categories, type Product } from "@/data/products";
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

/**
 * Add or edit a product.
 *
 * With no `product`, this is the create form (POST). With a `product`, it is
 * the edit form (PUT): fields start pre-filled and the slug is locked, because
 * the slug is the primary key and is also baked into the product's image keys
 * and its /shop URL — changing it would orphan both.
 */
export function ProductForm({
  product,
  onDone,
}: {
  product?: Product;
  onDone?: () => void;
}) {
  const router = useRouter();
  const isEdit = Boolean(product);

  const [name, setName] = React.useState(product?.name ?? "");
  const [slug, setSlug] = React.useState(product?.slug ?? "");
  const [slugTouched, setSlugTouched] = React.useState(isEdit);
  const [tagline, setTagline] = React.useState(product?.tagline ?? "");
  const [description, setDescription] = React.useState(product?.description ?? "");
  const [category, setCategory] = React.useState<string>(product?.category ?? "");
  const [featured, setFeatured] = React.useState(product?.featured ?? false);
  const [scents, setScents] = React.useState((product?.scents ?? []).join("\n"));
  const [usage, setUsage] = React.useState((product?.usage ?? []).join("\n"));
  const [variants, setVariants] = React.useState<VariantDraft[]>(
    product?.variants.length
      ? product.variants.map((v) => ({ size: v.size, sku: v.sku, price: String(v.price) }))
      : [emptyVariant()]
  );

  const [image, setImage] = React.useState(product?.image ?? "");
  const [uploading, setUploading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  // In edit mode the slug is fixed; otherwise it tracks the name until edited.
  const effectiveSlug = isEdit ? slug : slugTouched ? slug : slugify(name);

  function resetForm() {
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
  }

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
      const payload = {
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
      };

      const res = await fetch(
        isEdit ? `/api/admin/products/${product!.slug}` : "/api/admin/products",
        {
          method: isEdit ? "PUT" : "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Could not save product");

      toast.success(isEdit ? `${name} updated` : `${name} added`);
      if (isEdit) {
        onDone?.();
      } else {
        resetForm();
      }
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
          <Label htmlFor={`name-${effectiveSlug}`}>Product name</Label>
          <Input
            id={`name-${effectiveSlug}`}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Pine Gel"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`slug-${effectiveSlug}`}>URL slug</Label>
          <Input
            id={`slug-${effectiveSlug}`}
            value={effectiveSlug}
            onChange={(e) => {
              setSlugTouched(true);
              setSlug(slugify(e.target.value));
            }}
            placeholder="pine-gel"
            required
            readOnly={isEdit}
            className={isEdit ? "cursor-not-allowed bg-muted/50" : undefined}
          />
          <p className="text-xs text-muted-foreground">
            {isEdit ? "The slug can't be changed after creation." : `/shop/${effectiveSlug || "…"}`}
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor={`tagline-${effectiveSlug}`}>Tagline</Label>
        <Input
          id={`tagline-${effectiveSlug}`}
          value={tagline}
          onChange={(e) => setTagline(e.target.value)}
          placeholder="Fresh pine clean for every surface."
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor={`description-${effectiveSlug}`}>Description</Label>
        <Textarea
          id={`description-${effectiveSlug}`}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
          placeholder="A thick, economical multi-purpose pine gel…"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor={`category-${effectiveSlug}`}>Category</Label>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger id={`category-${effectiveSlug}`}>
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
        <Label htmlFor={`image-${effectiveSlug}`}>Product image</Label>
        <div className="flex flex-wrap items-center gap-4">
          {image ? (
            <div className="relative h-24 w-24 shrink-0 rounded border bg-muted/30">
              <Image src={image} alt="" fill className="object-contain p-1" />
            </div>
          ) : null}
          <div className="space-y-1">
            <Input
              id={`image-${effectiveSlug}`}
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
              ) : isEdit ? (
                "Leave empty to keep the current image, or upload a new one to replace it."
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
          <Label htmlFor={`scents-${effectiveSlug}`}>Scents — one per line</Label>
          <Textarea
            id={`scents-${effectiveSlug}`}
            value={scents}
            onChange={(e) => setScents(e.target.value)}
            rows={3}
            placeholder={"Pine\nLavender\nOcean"}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`usage-${effectiveSlug}`}>How to use — one per line</Label>
          <Textarea
            id={`usage-${effectiveSlug}`}
            value={usage}
            onChange={(e) => setUsage(e.target.value)}
            rows={3}
            placeholder={"Dilute in a bucket of water to mop floors.\nUse neat on tough stains."}
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={saving || uploading} className="w-full sm:w-auto">
          {saving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving…
            </>
          ) : isEdit ? (
            <>
              <Save className="mr-2 h-4 w-4" /> Save changes
            </>
          ) : (
            <>
              <Upload className="mr-2 h-4 w-4" /> Add product
            </>
          )}
        </Button>
        {isEdit ? (
          <Button
            type="button"
            variant="outline"
            disabled={saving}
            onClick={() => onDone?.()}
            className="w-full sm:w-auto"
          >
            <X className="mr-2 h-4 w-4" /> Cancel
          </Button>
        ) : null}
      </div>
    </form>
  );
}
