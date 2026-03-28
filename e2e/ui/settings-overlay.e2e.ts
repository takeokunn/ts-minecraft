import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'
import { GamePage } from '../fixtures/game-page'

test.describe('Settings overlay', () => {
  const waitForOverlayState = async (page: Page, open: boolean) => {
    await page.waitForFunction(
      ({ id, expected }: { id: string, expected: boolean }) => {
        const el = document.getElementById(id)
        if (!el) return false
        return expected ? el.style.display === 'block' : el.style.display === 'none'
      },
      { id: 'settings-overlay', expected: open }
    )
  }

  const waitForStoredSetting = async (page: Page, key: string, predicate: string) => {
    await page.waitForFunction(
      ({ storageKey, expression }: { storageKey: string, expression: string }) => {
        const raw = localStorage.getItem(storageKey)
        if (!raw) return false

        try {
          const settings = JSON.parse(raw) as Record<string, unknown>
          return Function('settings', `return ${expression}`)(settings) as boolean
        } catch {
          return false
        }
      },
      { storageKey: key, expression: predicate }
    )
  }

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
    await waitForOverlayState(page, true)

    const isOpen = await game.isOverlayOpen('settings-overlay')
    expect(isOpen).toBe(true)
  })

  test('second Escape key closes settings overlay', async ({ page }) => {
    const game = new GamePage(page)

    // Open it first
    await page.keyboard.press('Escape')
    await waitForOverlayState(page, true)
    const isOpen = await game.isOverlayOpen('settings-overlay')
    expect(isOpen).toBe(true)

    // Close it
    await page.keyboard.press('Escape')
    await waitForOverlayState(page, false)
    const isClosed = await game.isOverlayOpen('settings-overlay')
    expect(isClosed).toBe(false)
  })

  test('#settings-close button closes overlay', async ({ page }) => {
    const game = new GamePage(page)

    // Open settings
    await page.keyboard.press('Escape')
    await waitForOverlayState(page, true)

    // Click close button
    await page.locator('#settings-close').click()
    await waitForOverlayState(page, false)

    const isClosed = await game.isOverlayOpen('settings-overlay')
    expect(isClosed).toBe(false)
  })

  test('#settings-apply button is not rendered', async ({ page }) => {
    // Open settings
    await page.keyboard.press('Escape')
    await waitForOverlayState(page, true)

    await expect(page.locator('#settings-apply')).toHaveCount(0)
  })

  test('#rd-input slider is interactable', async ({ page }) => {
    // Open settings to make slider accessible
    await page.keyboard.press('Escape')
    await waitForOverlayState(page, true)

    // Verify slider exists and has a value
    const sliderValue = await page.evaluate(() => {
      const el = document.getElementById('rd-input') as HTMLInputElement | null
      return el ? el.value : null
    })
    expect(sliderValue).not.toBeNull()
    expect(Number(sliderValue)).toBeGreaterThan(0)
  })

  test('render distance change persists to localStorage immediately', async ({ page }) => {
    // Open settings
    await page.keyboard.press('Escape')
    await waitForOverlayState(page, true)

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
    await waitForStoredSetting(page, 'minecraft-settings', `settings.renderDistance === ${targetValue}`)

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

  test('checkbox toggles persist immediately without Apply', async ({ page }) => {
    await page.keyboard.press('Escape')
    await waitForOverlayState(page, true)

    await page.locator('#shadows-input').uncheck()
    await waitForStoredSetting(page, 'minecraft-settings', 'settings.shadowsEnabled === false')

    const storedShadowsEnabled = await page.evaluate((key) => {
      const raw = localStorage.getItem(key)
      if (!raw) return null
      try {
        return (JSON.parse(raw) as { shadowsEnabled?: boolean }).shadowsEnabled ?? null
      } catch {
        return null
      }
    }, 'minecraft-settings')

    expect(storedShadowsEnabled).toBe(false)
  })

  test('persisted render distance is reflected in slider after page reload', async ({ page }) => {
    // Open settings and set a known render distance
    await page.keyboard.press('Escape')
    await waitForOverlayState(page, true)

    const targetValue = 5

    await page.evaluate((val) => {
      const el = document.getElementById('rd-input') as HTMLInputElement | null
      if (!el) return
      el.value = String(val)
      el.dispatchEvent(new Event('input', { bubbles: true }))
    }, targetValue)
    await waitForStoredSetting(page, 'minecraft-settings', `settings.renderDistance === ${targetValue}`)

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
    await waitForOverlayState(page, true)

    const sliderValueAfterReload = await page.evaluate(() => {
      const el = document.getElementById('rd-input') as HTMLInputElement | null
      return el ? Number(el.value) : -1
    })

    expect(sliderValueAfterReload).toBe(targetValue)
  })
})
