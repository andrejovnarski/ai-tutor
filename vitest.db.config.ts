import { defineConfig } from "vitest/config";
import { loadEnv } from "vite";
import { fileURLToPath } from "node:url";

export default defineConfig(({ mode }) => ({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: {
    include: ["tests/db/**/*.db.test.ts"],
    globals: true,
    testTimeout: 30000,
    env: loadEnv(mode, process.cwd(), ""),
  },
}));
