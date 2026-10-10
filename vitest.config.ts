import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts", "src/app/play/**/*.test.{ts,tsx}"],
    // The rest of src/app is covered by Playwright; only the play tree runs
    // here (node environment, static markup via react-dom/server).
    exclude: [
      "tests/**",
      "src/app/api/**",
      "src/app/auth/**",
      "src/app/parent/**",
      "src/app/sign-in/**",
      "src/app/play/[[]kidId]/**",
      "node_modules/**",
    ],
    globals: true,
  },
});
