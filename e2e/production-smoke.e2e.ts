import { expect, test } from '@playwright/test'

test('built app boots without runtime ReferenceError', async ({ page }) => {
  const consoleErrors: string[] = []
  const pageErrors: string[] = []

  page.on('console', (message) => {
    if (message.type() === 'error') {
      consoleErrors.push(message.text())
    }
  })

  page.on('pageerror', (error) => {
    pageErrors.push(String(error))
  })

  await page.goto('http://127.0.0.1:4173', { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(3000)

  await expect(page).toHaveTitle('ts-minecraft')
  await expect(page.locator('#fps-counter')).toContainText('FPS:')
  await expect(page.locator('#health-display')).toContainText('20/20')

  const runtimeErrors = consoleErrors.filter((message) =>
    message.includes('ReferenceError: Cannot access') ||
    message.includes('TypeError:') ||
    message.includes('SyntaxError:')
  )

  expect(runtimeErrors).toEqual([])
  expect(pageErrors).toEqual([])
})
