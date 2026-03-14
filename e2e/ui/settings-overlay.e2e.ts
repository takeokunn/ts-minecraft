import { test, expect } from '@playwright/test'
import { GamePage } from '../fixtures/game-page'

test.describe('Settings overlay', () => {
  test.beforeEach(async ({ page }) => {
    const game = new GamePage(page)
    await game.goto()
    await game.waitForReady()
    // Ensure settings overlay is in DOM before tests (starts hidden, so use 'attached')
    await page.waitForSelector('#settings-overlay', { state: 'attached' })
  })

  test('Escape key opens settings overlay', async ({ page }) => {
    const game = new GamePage(page)

    // Verify closed initially
    const initiallyOpen = await game.isOverlayOpen('settings-overlay')
    expect(initiallyOpen).toBe(false)

    // Press Escape to open
    await page.keyboard.press('Escape')
    await page.waitForTimeout(300) // allow Effect pipeline to process

    const isOpen = await game.isOverlayOpen('settings-overlay')
    expect(isOpen).toBe(true)
  })

  test('second Escape key closes settings overlay', async ({ page }) => {
    const game = new GamePage(page)

    // Open it first
    await page.keyboard.press('Escape')
    await page.waitForTimeout(300)
    const isOpen = await game.isOverlayOpen('settings-overlay')
    expect(isOpen).toBe(true)

    // Close it
    await page.keyboard.press('Escape')
    await page.waitForTimeout(300)
    const isClosed = await game.isOverlayOpen('settings-overlay')
    expect(isClosed).toBe(false)
  })

  test('#settings-close button closes overlay', async ({ page }) => {
    const game = new GamePage(page)

    // Open settings
    await page.keyboard.press('Escape')
    await page.waitForTimeout(300)

    // Click close button
    await page.locator('#settings-close').click()
    await page.waitForTimeout(300)

    const isClosed = await game.isOverlayOpen('settings-overlay')
    expect(isClosed).toBe(false)
  })

  test('#settings-apply button is clickable without errors', async ({ page }) => {
    // Open settings
    await page.keyboard.press('Escape')
    await page.waitForTimeout(300)

    // Click apply — should not crash
    await page.locator('#settings-apply').click()
    await page.waitForTimeout(300)

    // Page should still be functional
    const fps = await page.evaluate(() =>
      parseFloat(document.getElementById('fps-value')?.textContent ?? '0')
    )
    expect(fps).toBeGreaterThanOrEqual(0)
  })

  test('#rd-input slider is interactable', async ({ page }) => {
    // Open settings to make slider accessible
    await page.keyboard.press('Escape')
    await page.waitForTimeout(300)

    // Verify slider exists and has a value
    const sliderValue = await page.evaluate(() => {
      const el = document.getElementById('rd-input') as HTMLInputElement | null
      return el ? el.value : null
    })
    expect(sliderValue).not.toBeNull()
    expect(Number(sliderValue)).toBeGreaterThan(0)
  })
})
