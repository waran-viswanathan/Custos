import { defineConfig } from '@playwright/test';
import path from 'node:path';

export default defineConfig({
  testDir: './e2e',
  use: { baseURL: 'http://127.0.0.1:4317', headless: true },
  webServer: {
    command: 'pnpm --filter @custos/dashboard exec next start -p 4317 -H 127.0.0.1',
    cwd: path.resolve(__dirname, '..'),
    url: 'http://127.0.0.1:4317/login',
    timeout: 60_000,
    env: { SESSION_SECRET: 'browser-test-only-session-secret-32-chars', NEXT_TELEMETRY_DISABLED: '1' },
  },
});
