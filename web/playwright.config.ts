import { defineConfig, devices } from "@playwright/test";

/**
 * E2E config. Assumes BOTH servers are already running:
 *   - web  : http://localhost:3000  (npm --prefix web run dev)
 *   - api  : http://localhost:8787  (npm --prefix server run dev)
 * swiftshader GL args let the WebGL Dither background render headlessly.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: 1,
  timeout: 45_000,
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]],
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
    launchOptions: {
      args: ["--use-gl=angle", "--use-angle=swiftshader", "--ignore-gpu-blocklist"],
    },
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
