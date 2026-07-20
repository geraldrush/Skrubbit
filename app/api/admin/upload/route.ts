import { getCloudflareContext } from "@opennextjs/cloudflare";

import { requireAdmin } from "@/lib/admin-auth";

/**
 * Uploads a product image to R2 and returns the path to store on the product.
 *
 * Note: the image is stored as-uploaded. Workers have no image processing
 * runtime (sharp is a build-time dependency and cannot run here), so size is
 * enforced by rejecting oversized files rather than by re-encoding them. The
 * seeded catalogue images were optimised offline to ~25-100 KB each; uploads
 * much larger than that will make the shop noticeably slower.
 */

export const dynamic = "force-dynamic";

const MAX_BYTES = 2 * 1024 * 1024; // 2 MB
const ALLOWED = new Set(["image/webp", "image/png", "image/jpeg"]);
const EXT: Record<string, string> = {
  "image/webp": "webp",
  "image/png": "png",
  "image/jpeg": "jpg",
};

export async function POST(req: Request) {
  const { env } = getCloudflareContext();
  const denied = await requireAdmin(req, env);
  if (denied) return denied;

  const form = await req.formData();
  const file = form.get("file");
  const slug = String(form.get("slug") ?? "").trim();

  if (!(file instanceof File)) {
    return Response.json({ error: "No file uploaded." }, { status: 400 });
  }
  if (!/^[a-z0-9-]+$/.test(slug)) {
    return Response.json({ error: "A valid product slug is required." }, { status: 400 });
  }
  if (!ALLOWED.has(file.type)) {
    return Response.json(
      { error: `Unsupported type ${file.type || "unknown"}. Use WebP, PNG or JPEG.` },
      { status: 400 }
    );
  }
  if (file.size > MAX_BYTES) {
    return Response.json(
      {
        error: `Image is ${(file.size / 1024 / 1024).toFixed(1)} MB. Please resize to under 2 MB — large images make the shop slow.`,
      },
      { status: 400 }
    );
  }

  // Cache-busting suffix: image URLs are served immutable, so a replacement
  // must land on a new key or browsers would keep the old picture.
  const key = `products/${slug}-${Date.now().toString(36)}.${EXT[file.type]}`;

  await env.PRODUCT_IMAGES.put(key, await file.arrayBuffer(), {
    httpMetadata: {
      contentType: file.type,
      cacheControl: "public, max-age=31536000, immutable",
    },
  });

  return Response.json({ path: `/img/${key}` });
}
