import { defineCloudflareConfig } from "@opennextjs/cloudflare";

export default defineCloudflareConfig({
  // Incremental cache / tags / queue can be enabled here later when we add
  // Cloudflare KV or R2. For now the default (in-worker) behaviour is fine.
});
