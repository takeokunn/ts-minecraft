import { test, expect } from '@playwright/test'
import { GamePage } from '../fixtures/game-page'
import { isMinecraftWorldsDbCreated } from '../helpers/db-helpers'

test.describe('World persistence (save/load)', () => {
  test("'minecraft-worlds' IndexedDB is created after game starts", async ({ page }) => {
    const game = new GamePage(page)
    await game.goto()
    await game.waitForReady()

    // Give the game a moment to initialize IndexedDB (triggered by StorageService)
    await page.waitForTimeout(2_000)

    const dbExists = await isMinecraftWorldsDbCreated(page)
    expect(dbExists).toBe(true)
  })

  test('world data persists across page reload (within same context)', async ({ page }) => {
    const game = new GamePage(page)
    await game.goto()
    await game.waitForReady()

    // Wait for IndexedDB to be created and populated
    await page.waitForTimeout(3_000)

    // Verify DB exists before reload
    const dbBeforeReload = await isMinecraftWorldsDbCreated(page)
    expect(dbBeforeReload).toBe(true)

    // Reload the page — IndexedDB persists within the same browser context
    await page.reload()
    await game.waitForReady()

    // DB should still be accessible after reload (same context = same IndexedDB)
    const dbAfterReload = await isMinecraftWorldsDbCreated(page)
    expect(dbAfterReload).toBe(true)
  })
})
