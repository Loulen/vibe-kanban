import { defineConfig } from '@playwright/test';

const devServerPort = 4173;
const devServerHost = 'localhost';
const baseURL = `http://${devServerHost}:${devServerPort}`;

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL,
  },
  webServer: {
    command: `npm exec -- pnpm --filter @vibe/local-web run dev --port ${devServerPort}`,
    url: `${baseURL}/mermaid-e2e.html`,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
