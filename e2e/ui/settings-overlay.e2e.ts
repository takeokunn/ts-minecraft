import { test, expect, type PlaywrightTestArgs } from '@playwright/test'
import { GamePage } from '../fixtures/game-page'
import { getMinecraftSettings, type MinecraftSettingsSnapshot } from '../helpers/db-helpers'
import { openPauseMenu, waitForPauseMenu } from '../helpers/wait-helpers'

type Page = PlaywrightTestArgs['page']

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

  const waitForStoredSetting = async (
    page: Page,
    predicate: (settings: MinecraftSettingsSnapshot) => boolean,
  ) => {
    await expect.poll(async () => {
      const settings = await getMinecraftSettings(page)
      return settings !== null && predicate(settings)
    }, { timeout: 10_000 }).toBe(true)
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

    // ESC now opens the pause menu; click Settings to open the overlay
    await openPauseMenu(page)
    await page.click('[data-role="settings"]')
    await waitForOverlayState(page, true)

    const isOpen = await game.isOverlayOpen('settings-overlay')
    expect(isOpen).toBe(true)
  })

  test('second Escape key closes settings overlay', async ({ page }) => {
    const game = new GamePage(page)

    // Open settings via pause menu flow
    await openPauseMenu(page)
    await page.click('[data-role="settings"]')
    await waitForOverlayState(page, true)
    const isOpen = await game.isOverlayOpen('settings-overlay')
    expect(isOpen).toBe(true)

    // Close settings overlay with Escape
    await page.keyboard.press('Escape')
    await waitForOverlayState(page, false)
    const isClosed = await game.isOverlayOpen('settings-overlay')
    expect(isClosed).toBe(false)
  })

  test('pause -> settings -> resume returns to active gameplay state', async ({ page }) => {
    await openPauseMenu(page)
    await page.click('[data-role="settings"]')
    await waitForOverlayState(page, true)
    await expect(page.locator('#pause-menu-backdrop')).toBeHidden()

    await page.keyboard.press('Escape')
    await waitForOverlayState(page, false)
    await waitForPauseMenu(page)

    await page.click('[data-role="resume"]')
    await expect(page.locator('#pause-menu-backdrop')).toBeHidden()
    await expect(page.locator('#settings-overlay')).toBeHidden()

    await page.keyboard.press('e')
    await expect(page.locator('#inventory-overlay')).toBeVisible()
    await page.keyboard.press('e')
    await expect(page.locator('#inventory-overlay')).toBeHidden()
  })

  test('#settings-close button closes overlay', async ({ page }) => {
    const game = new GamePage(page)

    // Open settings via pause menu flow
    await openPauseMenu(page)
    await page.click('[data-role="settings"]')
    await waitForOverlayState(page, true)

    // Click close button
    await page.locator('#settings-close').click()
    await waitForOverlayState(page, false)

    const isClosed = await game.isOverlayOpen('settings-overlay')
    expect(isClosed).toBe(false)
  })

  test('#settings-apply button is not rendered', async ({ page }) => {
    // Open settings via pause menu flow
    await openPauseMenu(page)
    await page.click('[data-role="settings"]')
    await waitForOverlayState(page, true)

    expect(await page.locator('#settings-apply').count()).toBe(0)
  })

  test('#rd-input slider is interactable', async ({ page }) => {
    // Open settings via pause menu flow
    await openPauseMenu(page)
    await page.click('[data-role="settings"]')
    await waitForOverlayState(page, true)

    // Verify slider exists and has a value
    const sliderValue = await page.evaluate(() => {
      const el = document.getElementById('rd-input') as HTMLInputElement | null
      return el ? el.value : null
    })
    expect(sliderValue).not.toBeNull()
    expect(Number(sliderValue) > 0).toBe(true)
  })

  test('render distance change persists immediately', async ({ page }) => {
    // Open settings via pause menu flow
    await openPauseMenu(page)
    await page.click('[data-role="settings"]')
    await waitForOverlayState(page, true)

    // Read current slider value and compute a new distinct value
    const originalValue = await page.evaluate(() => {
      const el = document.getElementById('rd-input') as HTMLInputElement | null
      return el ? Number(el.value) : 8
    })

    // Choose a target value different from the current one, staying within [2, 16]
    const targetValue = originalValue === 10 ? 6 : 10

    // Set the slider value via JS and fire an 'input' event so the overlay handler picks it up
    await page.evaluate((val: number) => {
      const renderDistanceInput = document.getElementById('rd-input') as HTMLInputElement | null
      const adaptivePerformanceInput = document.getElementById('adaptive-performance-input') as HTMLInputElement | null
      if (!renderDistanceInput || !adaptivePerformanceInput) return

      renderDistanceInput.value = String(val)
      renderDistanceInput.dispatchEvent(new Event('input', { bubbles: true }))
      adaptivePerformanceInput.checked = false
      adaptivePerformanceInput.dispatchEvent(new Event('change', { bubbles: true }))
    }, targetValue)
    await waitForStoredSetting(
      page,
      (settings) => settings.renderDistance === targetValue && settings.adaptivePerformanceMode === false,
    )

    const storedRenderDistance = (await getMinecraftSettings(page))?.renderDistance ?? null

    expect(storedRenderDistance).toBe(targetValue)
  })

  test('quality selection persists immediately without Apply', async ({ page }) => {
    await openPauseMenu(page)
    await page.click('[data-role="settings"]')
    await waitForOverlayState(page, true)

    await page.locator('#quality-select').selectOption('low')
    await waitForStoredSetting(page, (settings) => settings.graphicsQuality === 'low')

    const storedGraphicsQuality = (await getMinecraftSettings(page))?.graphicsQuality ?? null

    expect(storedGraphicsQuality).toBe('low')
  })

  test('persisted render distance is reflected in slider after page reload', async ({ page }) => {
    test.setTimeout(120_000)
    const game = new GamePage(page)

    // Open settings via pause menu flow and set a known render distance
    await openPauseMenu(page)
    await page.click('[data-role="settings"]')
    await waitForOverlayState(page, true)

    const targetValue = 5

    await page.evaluate((val: number) => {
      const renderDistanceInput = document.getElementById('rd-input') as HTMLInputElement | null
      const adaptivePerformanceInput = document.getElementById('adaptive-performance-input') as HTMLInputElement | null
      if (!renderDistanceInput || !adaptivePerformanceInput) return

      renderDistanceInput.value = String(val)
      renderDistanceInput.dispatchEvent(new Event('input', { bubbles: true }))
      adaptivePerformanceInput.checked = false
      adaptivePerformanceInput.dispatchEvent(new Event('change', { bubbles: true }))
    }, targetValue)
    await waitForStoredSetting(
      page,
      (settings) => settings.renderDistance === targetValue && settings.adaptivePerformanceMode === false,
    )

    // Reload the page; IndexedDB persists within the same browser context.
    await page.reload()

    // Reload returns to the main menu; start a new session without clearing localStorage.
    await game.startNewWorldFromMainMenu()
    await game.waitForReady(90_000)
    await page.waitForSelector('#settings-overlay', { state: 'attached', timeout: 8_000 })
    await page.waitForSelector('#settings-gear-btn', { state: 'visible', timeout: 8_000 })

    // Open settings directly; this test verifies persisted settings, not pause-menu routing.
    await page.click('#settings-gear-btn')
    await waitForOverlayState(page, true)

    const sliderValueAfterReload = await page.evaluate(() => {
      const el = document.getElementById('rd-input') as HTMLInputElement | null
      return el ? Number(el.value) : -1
    })

    expect(sliderValueAfterReload).toBe(targetValue)
  })
})
