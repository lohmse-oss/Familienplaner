import { defineConfig } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WEB_PORT = Number(process.env.E2E_WEB_PORT || 4173);
const SYNC_PORT = Number(process.env.E2E_SYNC_PORT || 4181);
const SYNC_TOKEN = 'e2e-sync-token';
const DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'fp-e2e-sync-'));

const BASE_URL = `http://127.0.0.1:${WEB_PORT}`;
const SYNC_URL = `http://127.0.0.1:${SYNC_PORT}`;

process.env.E2E_BASE_URL = BASE_URL;
process.env.E2E_SYNC_URL = SYNC_URL;
process.env.E2E_SYNC_TOKEN = SYNC_TOKEN;

export default defineConfig({
  testDir: './e2e',
  timeout: 45_000,
  expect: { timeout: 8_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list']],
  use: {
    baseURL: BASE_URL,
    headless: true,
    viewport: { width: 1280, height: 900 }
  },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
  webServer: [
    {
      command: `node ${path.join(REPO, 'test/static-server.mjs')}`,
      env: { ...process.env, PORT: String(WEB_PORT), HOST: '127.0.0.1', ROOT: REPO },
      url: `${BASE_URL}/index.html`,
      reuseExistingServer: !process.env.CI,
      timeout: 15_000
    },
    {
      command: `node ${path.join(REPO, 'server/sync-server.js')}`,
      env: { ...process.env, PORT: String(SYNC_PORT), HOST: '127.0.0.1', SYNC_TOKEN, DATA_DIR },
      url: `${SYNC_URL}/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 15_000
    }
  ]
});
