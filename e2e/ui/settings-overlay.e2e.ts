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

  test('render distance change persists to localStorage after Apply', async ({ page }) => {
    // Open settings
    await page.keyboard.press('Escape')
    await page.waitForTimeout(300)

    // Read current slider value and compute a new distinct value
    const originalValue = await page.evaluate(() => {
      const el = document.getElementById('rd-input') as HTMLInputElement | null
      return el ? Number(el.value) : 8
    })

    // Choose a target value different from the current one, staying within [2, 16]
    const targetValue = originalValue === 10 ? 6 : 10

    // Set the slider value via JS and fire an 'input' event so the overlay handler picks it up
    await page.evaluate((val) => {
      const el = document.getElementById('rd-input') as HTMLInputElement | null
      if (!el) return
      el.value = String(val)
      el.dispatchEvent(new Event('input', { bubbles: true }))
    }, targetValue)
    await page.waitForTimeout(200)

    // Click Apply to persist the setting
    await page.locator('#settings-apply').click()
    await page.waitForTimeout(500)

    // Verify localStorage was updated with the new render distance
    const storedRenderDistance = await page.evaluate((key) => {
      const raw = localStorage.getItem(key)
      if (!raw) return null
      try {
        return (JSON.parse(raw) as { renderDistance?: number }).renderDistance ?? null
      } catch {
        return null
      }
    }, 'minecraft-settings')

    expect(storedRenderDistance).toBe(targetValue)
  })

  test('persisted render distance is reflected in slider after page reload', async ({ page }) => {
    // Open settings and set a known render distance
    await page.keyboard.press('Escape')
    await page.waitForTimeout(300)

    const targetValue = 5

    await page.evaluate((val) => {
      const el = document.getElementById('rd-input') as HTMLInputElement | null
      if (!el) return
      el.value = String(val)
      el.dispatchEvent(new Event('input', { bubbles: true }))
    }, targetValue)
    await page.waitForTimeout(200)

    await page.locator('#settings-apply').click()
    await page.waitForTimeout(500)

    // Reload the page — localStorage persists within the same browser context
    await page.reload()

    // Wait for game to be ready again
    await page.waitForFunction(
      () => {
        const el = document.getElementById('fps-value')
        return el !== null && parseFloat(el.textContent ?? '0') > 0
      },
      { timeout: 25_000, polling: 200 }
    )
    await page.waitForSelector('#settings-overlay', { state: 'attached', timeout: 8_000 })

    // Open settings overlay to reveal the slider
    await page.keyboard.press('Escape')
    await page.waitForTimeout(300)

    const sliderValueAfterReload = await page.evaluate(() => {
      const el = document.getElementById('rd-input') as HTMLInputElement | null
      return el ? Number(el.value) : -1
    })

    expect(sliderValueAfterReload).toBe(targetValue)
  })
})
