import { defineConfig, devices } from '@playwright/test'

// Software rendering via SwiftShader is always used in e2e tests (no real GPU in headless mode).
// Set this so test files can detect software rendering and apply appropriate thresholds.
process.env['PLAYWRIGHT_USE_SWIFTSHADER'] = '1'

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.e2e.ts',
  timeout: 60_000,
  retries: process.env['CI'] ? 1 : 0,
  workers: process.env['CI'] ? 1 : 2,
  forbidOnly: !!process.env['CI'],

  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'playwright-report' }],
    ['junit', { outputFile: 'test-results/e2e-junit.xml' }],
  ],

  use: {
    baseURL: 'http://localhost:5180',
    viewport: { width: 1280, height: 720 },
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    launchOptions: {
      args: [
        // Use ANGLE with SwiftShader backend for software WebGL on macOS arm64
        '--use-gl=angle',
        '--use-angle=swiftshader',
        '--enable-webgl',
        '--enable-webgl2',
        '--ignore-gpu-blocklist',
        '--enable-unsafe-swiftshader',
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
      ],
    },
  },

  projects: [
    {
      name: 'chromium-webgl',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: {
    command: 'pnpm dev --port 5180 --strictPort',
    url: 'http://localhost:5180',
    reuseExistingServer: !process.env['CI'],
    timeout: 60_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
})
