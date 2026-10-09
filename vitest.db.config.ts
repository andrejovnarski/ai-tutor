import { defineConfig } from "vitest/config";
import { loadEnv } from "vite";
import { fileURLToPath } from "node:url";

export default defineConfig(({ mode }) => ({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: {
    globalSetup: ["tests/db/globalSetup.ts"],
    include: ["tests/db/**/*.db.test.ts"],
    globals: true,
    fileParallelism: false, // crons (retention, weekly report) act on every parent and flag, so files must not overlap
    testTimeout: 30000,
    env: loadEnv(mode, process.cwd(), ""),
  },
}));
