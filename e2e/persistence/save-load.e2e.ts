import { test, expect } from '@playwright/test'
import { GamePage } from '../fixtures/game-page'
import { getMinecraftWorldsDbSnapshot } from '../helpers/db-helpers'
import { waitForMainMenu } from '../helpers/wait-helpers'

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
})
