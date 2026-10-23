import { defineConfig, devices } from '@playwright/test'

/**
 * Tests de bout en bout sur un téléphone (Pixel 7) contre un Supabase local (`npx supabase start`).
 * L'app est construite puis servie par `vite preview`, comme en production (service worker compris).
 * L'URL et la clé anon viennent de `.env.local` (voir docs/LOT-08.md).
 */
export default defineConfig({
  testDir: 'e2e',
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  timeout: 45_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: 'http://localhost:4173',
    locale: 'fr-CA',
    timezoneId: 'America/Toronto',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'téléphone', use: { ...devices['Pixel 7'] } }],
  webServer: {
    command: 'npx vite build && npx vite preview --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
})
