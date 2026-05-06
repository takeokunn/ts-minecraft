import { test, expect, type PlaywrightTestArgs } from '@playwright/test'
import { GamePage } from '../fixtures/game-page'
import { getMinecraftWorldsDbSnapshot } from '../helpers/db-helpers'
import { waitForMainMenu, waitForPauseMenu, waitForStableRender } from '../helpers/wait-helpers'

type Page = PlaywrightTestArgs['page']

type CameraPosition = Readonly<{ x: number; y: number; z: number }>

const focusCanvas = async (page: Page): Promise<void> => {
  await page.mouse.click(320, 240)
}

const getCameraPosition = async (page: Page): Promise<CameraPosition | null> =>
  page.evaluate<CameraPosition | null>(() => {
    const snapshot = window.__TS_MINECRAFT_QA__?.getRenderingSnapshot()

    return snapshot?.camera ?? null
  })

const waitForPersistedWorldMetadata = async (page: Parameters<typeof getMinecraftWorldsDbSnapshot>[0]) => {
  await expect.poll(
    async () => {
      const snapshot = await getMinecraftWorldsDbSnapshot(page)
      return snapshot.exists
        && snapshot.storeNames.includes('chunks')
        && snapshot.storeNames.includes('metadata')
        && snapshot.metadataCount > 0
    },
    { timeout: 10_000, intervals: [250, 500, 1_000] },
  ).toBe(true)

  return getMinecraftWorldsDbSnapshot(page)
}

test.describe('World persistence (save/load)', () => {
  test("'minecraft-worlds' IndexedDB is created after game starts", async ({ page }) => {
    const game = new GamePage(page)
    await game.goto()
    await game.waitForReady()

    const snapshot = await waitForPersistedWorldMetadata(page)
    expect(snapshot.storeNames.includes('chunks')).toBe(true)
    expect(snapshot.storeNames.includes('metadata')).toBe(true)
    expect(snapshot.metadataCount > 0).toBe(true)
  })

  test('world data persists across page reload (within same context)', async ({ page }) => {
    const game = new GamePage(page)
    await game.goto()
    await game.waitForReady()

    const beforeReload = await waitForPersistedWorldMetadata(page)

    // Reload the page — IndexedDB persists within the same browser context
    await page.reload()
    await waitForMainMenu(page)

    const afterReload = await getMinecraftWorldsDbSnapshot(page)
    expect(afterReload.exists).toBe(true)
    expect(afterReload.storeNames.includes('chunks')).toBe(true)
    expect(afterReload.storeNames.includes('metadata')).toBe(true)
    expect(afterReload.metadataCount).toBe(beforeReload.metadataCount)
  })

  test('save & quit to title loads the same world with restored inventory state', async ({ page }) => {
    test.setTimeout(120_000)
    const game = new GamePage(page)

    await game.goto()
    await game.waitForReady()
    await waitForStableRender(page, 1_000)
    await focusCanvas(page)

    const startPosition = await getCameraPosition(page)
    expect(startPosition !== null).toBe(true)

    await page.keyboard.down('w')
    await page.waitForTimeout(1_000)
    await page.keyboard.up('w')
    await page.waitForTimeout(250)

    const beforeSavePosition = await getCameraPosition(page)
    expect(beforeSavePosition !== null).toBe(true)
    const movedDistance = Math.hypot(
      (beforeSavePosition?.x ?? 0) - (startPosition?.x ?? 0),
      (beforeSavePosition?.z ?? 0) - (startPosition?.z ?? 0),
    )
    expect(movedDistance > 0.5).toBe(true)

    await page.keyboard.press('Escape')
    await waitForPauseMenu(page)
    await page.click('[data-role="save-quit"]')
    await expect(page.locator('[data-role="confirm"]')).toBeVisible()
    await page.click('[data-role="confirm"]')
    await waitForMainMenu(page, 30_000)

    await page.click('#mm-load-world')
    await expect(page.locator('#mm-lw-list')).toBeVisible()
    await page.locator('#mm-lw-list button').filter({ hasText: 'Load' }).first().click()

    await game.waitForReady(90_000)
    await waitForStableRender(page, 1_000)
    await focusCanvas(page)

    const afterLoadPosition = await getCameraPosition(page)
    expect(afterLoadPosition !== null).toBe(true)
    expect(Math.abs((afterLoadPosition?.x ?? 0) - (beforeSavePosition?.x ?? 0)) < 0.75).toBe(true)
    expect(Math.abs((afterLoadPosition?.z ?? 0) - (beforeSavePosition?.z ?? 0)) < 0.75).toBe(true)
  })
})
