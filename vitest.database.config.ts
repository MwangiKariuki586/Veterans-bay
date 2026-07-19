import { config } from "dotenv";
import { defineConfig } from "vitest/config";

config();

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/platform/database/**/*.test.ts"],
    fileParallelism: false,
    hookTimeout: 60_000,
    testTimeout: 60_000,
  },
});
