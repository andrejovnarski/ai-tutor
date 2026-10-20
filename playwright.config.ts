import path from "node:path";
import { defineConfig } from "@playwright/test";

try {
  process.loadEnvFile(".env.local");
} catch {
  // no .env.local: tests that need Supabase will fail loudly
}

export default defineConfig({
  testDir: "tests/e2e",
  // Local Supabase auth runs out of ports (dial "cannot assign requested address") under 6 parallel workers.
  workers: 3,
  globalSetup: "./tests/e2e/globalSetup.ts",
  webServer: {
    command: "npm run build && npm run start",
    port: 3000,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    // Speech on with the fake recogniser and voice: the mic shows on every problem and every line asks for audio.
    // Rewards on: the end card, picker and child page show them.
    env: { SPEECH: "fake", SPEECH_TOKEN_SECRET: "e2e-secret", REWARDS: "on" },
  },
  use: { baseURL: "http://localhost:3000" },
  projects: [
    {
      name: "tablet",
      use: {
        viewport: { width: 1024, height: 768 },
        hasTouch: true,
        launchOptions: {
          args: [
            "--use-fake-ui-for-media-stream",
            "--use-fake-device-for-media-stream",
            // A voice-like half second, then quiet, on a loop: trips the recorder's speech gate, then its 1 s stop.
            `--use-file-for-fake-audio-capture=${path.resolve("tests/fixtures/loud-then-quiet.wav")}`,
            "--autoplay-policy=no-user-gesture-required",
          ],
        },
      },
    },
  ],
});
