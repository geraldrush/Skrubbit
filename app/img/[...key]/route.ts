import { getCloudflareContext } from "@opennextjs/cloudflare";

/**
 * Serves product images out of the R2 bucket.
 *
 * R2 buckets are private by default, so rather than exposing the bucket via a
 * public r2.dev URL or a custom domain, images are proxied through the Worker.
 * Objects are content-addressed by key and never rewritten in place (the admin
 * writes a new key on re-upload), so they can be cached aggressively.
 */

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ key: string[] }> }
) {
  const { key } = await params;
  const objectKey = key.join("/");

  // Keys come from the URL, so refuse traversal attempts outright.
  if (objectKey.includes("..")) {
    return new Response("Bad request", { status: 400 });
  }

  const object = await getCloudflareContext().env.PRODUCT_IMAGES.get(objectKey);
  if (!object) {
    return new Response("Not found", { status: 404 });
  }

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  headers.set("cache-control", "public, max-age=31536000, immutable");

  return new Response(object.body, { headers });
}
