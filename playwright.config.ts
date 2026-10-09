import { defineConfig } from "@playwright/test";

try {
  process.loadEnvFile(".env.local");
} catch {
  // no .env.local: tests that need Supabase will fail loudly
}

export default defineConfig({
  testDir: "tests/e2e",
  webServer: {
    command: "npm run build && npm run start",
    port: 3000,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
  use: { baseURL: "http://localhost:3000" },
  projects: [
    {
      name: "tablet",
      use: { viewport: { width: 1024, height: 768 }, hasTouch: true },
    },
  ],
});
