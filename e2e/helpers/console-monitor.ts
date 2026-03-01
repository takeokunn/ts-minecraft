import type { Page } from '@playwright/test'

/**
 * Monitors browser console for FATAL startup errors only.
 * The game intentionally uses console.error for non-fatal Effect pipeline errors —
 * do NOT use this to assert "no console.error" broadly.
 * Only monitor for the pattern that indicates complete startup failure.
 */
export function attachFatalErrorMonitor(page: Page): () => string[] {
  const fatalErrors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error' && msg.text().includes('Failed to start application')) {
      fatalErrors.push(msg.text())
    }
  })
  return () => [...fatalErrors]
}
