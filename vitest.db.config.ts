import { defineConfig } from "vitest/config";
import { loadEnv } from "vite";

export default defineConfig(({ mode }) => ({
  test: {
    include: ["tests/db/**/*.db.test.ts"],
    globals: true,
    testTimeout: 30000,
    env: loadEnv(mode, process.cwd(), ""),
  },
}));
