import { cloudflareTest } from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [
    cloudflareTest({
      wrangler: {
        configPath: "./wrangler.api.jsonc",
      },
    }),
  ],
  test: {
    include: ["src/**/*.test.ts"],
    exclude: ["src/platform/database/**/*.test.ts"],
  },
});
