import { getCloudflareContext } from "@opennextjs/cloudflare";

/**
 * Serves product images out of the R2 bucket.
 *
 * R2 buckets are private by default, so rather than exposing the bucket via a
 * public r2.dev URL or a custom domain, images are proxied through the Worker.
 * Objects are content-addressed by key and never rewritten in place (the admin
 * writes a new key on re-upload), so they can be cached aggressively.
 *
 * This route is a public, unauthenticated reader for whatever key it is given,
 * so it is restricted to the one prefix it exists to serve. Without that, any
 * object that ever lands in the bucket — a backup, an export — becomes
 * world-readable at a guessable URL.
 */

export const dynamic = "force-dynamic";

/** Must match the key prefix written by /api/admin/upload. */
const ALLOWED_PREFIX = "products/";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ key: string[] }> }
) {
  const { key } = await params;
  const objectKey = key.join("/");

  // R2 keys are a flat namespace, so there is no path traversal to defend
  // against here — the prefix allowlist is the actual control. 404 rather than
  // 403 so this doesn't confirm what else the bucket holds.
  if (!objectKey.startsWith(ALLOWED_PREFIX)) {
    return new Response("Not found", { status: 404 });
  }

  const object = await getCloudflareContext().env.PRODUCT_IMAGES.get(objectKey);
  if (!object) {
    return new Response("Not found", { status: 404 });
  }

  const headers = new Headers();
  // Set the content type from the stored metadata rather than via
  // writeHttpMetadata(): that method takes a Headers instance, which cannot
  // cross the RPC boundary the `next dev` binding proxy uses, so it throws
  // ("Cannot stringify arbitrary non-POJOs") in local development. Content
  // type is the only metadata worth copying — the cache-control below is set
  // deliberately and would override the stored one anyway.
  headers.set(
    "content-type",
    object.httpMetadata?.contentType ?? "application/octet-stream"
  );
  headers.set("etag", object.httpEtag);
  headers.set("cache-control", "public, max-age=31536000, immutable");
  // The content type is whatever the uploader claimed; don't let a browser
  // sniff its way to a different one.
  headers.set("x-content-type-options", "nosniff");

  return new Response(object.body, { headers });
}
