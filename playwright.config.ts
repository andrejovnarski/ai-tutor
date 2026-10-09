import { defineConfig } from "@playwright/test";

try {
  process.loadEnvFile(".env.local");
} catch {
  // no .env.local: tests that need Supabase will fail loudly
}

const port = Number(process.env.E2E_PORT ?? 3000);

export default defineConfig({
  testDir: "tests/e2e",
  webServer: {
    command: `npm run build && npm run start -- -p ${port}`,
    port,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
  use: { baseURL: `http://localhost:${port}` },
  projects: [
    {
      name: "tablet",
      use: { viewport: { width: 1024, height: 768 }, hasTouch: true },
    },
  ],
});
