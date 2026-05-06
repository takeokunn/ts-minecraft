import { test, expect } from '@playwright/test'
import { GamePage } from '../fixtures/game-page'
import { attachFatalErrorMonitor } from '../helpers/console-monitor'
import { waitForStableRender } from '../helpers/wait-helpers'

async function openInventory(page: Page): Promise<void> {
  await page.evaluate(() => window.__TS_MINECRAFT_QA__?.openInventoryForQA())
  await page.waitForFunction(() => {
    const overlay = document.getElementById('inventory-overlay')
    return overlay instanceof HTMLDivElement && getComputedStyle(overlay).display !== 'none'
  }, undefined, { timeout: 5_000 })
}

async function clickRecipe(page: Page, recipeId: string): Promise<void> {
  await page.evaluate((id: string) => window.__TS_MINECRAFT_QA__?.craftRecipeForQA(id), recipeId)
  await page.waitForTimeout(100)
}

async function waitForRuntimeReady(page: Page): Promise<void> {
  await page.waitForSelector('#game-canvas', { timeout: 30_000 })
  await page.waitForSelector('#crosshair', { state: 'attached', timeout: 30_000 })
  await page.waitForSelector('#settings-overlay', { state: 'attached', timeout: 30_000 })
}

test.describe('Progression loop', () => {
  test('supports gather → craft → build → fight through the runtime loop', async ({ page }) => {
    test.setTimeout(120_000)
    const getFatalErrors = attachFatalErrorMonitor(page)
    const game = new GamePage(page)

    await game.goto()
    await waitForRuntimeReady(page)
    await waitForStableRender(page, 1_000)

    await page.evaluate(() => window.__TS_MINECRAFT_QA__?.stageProgressionScenario())
    await page.evaluate(() => window.__TS_MINECRAFT_QA__?.collectStagedResources())
    await page.waitForTimeout(200)

    const afterGather = await page.evaluate(() => window.__TS_MINECRAFT_QA__?.getInventorySnapshot() ?? [])
    const gatheredWood = afterGather.reduce((sum: number, slot: { slot: number; itemType: string; count: number } | null) => sum + (slot?.itemType === 'WOOD' ? slot.count : 0), 0)
    expect(gatheredWood >= 3).toBe(true)

    await openInventory(page)
    await clickRecipe(page, 'wood-to-planks')
    await clickRecipe(page, 'wood-to-planks')
    await clickRecipe(page, 'wood-to-planks')
    await clickRecipe(page, 'planks-to-sticks')
    await clickRecipe(page, 'planks-to-crafting-table')

    const moved = await page.evaluate(async () => {
      const qa = window.__TS_MINECRAFT_QA__
      if (!qa) return { movedTable: false, craftingTables: 0 }
      const movedTable = await qa.moveItemToHotbar('CRAFTING_TABLE', 0)
      const snapshot = await qa.getInventorySnapshot()
      return {
        movedTable,
        craftingTables: snapshot.reduce((sum: number, slot: { slot: number; itemType: string; count: number } | null) => sum + (slot?.itemType === 'CRAFTING_TABLE' ? slot.count : 0), 0),
      }
    })
    expect(moved.movedTable).toBe(true)
    expect(moved.craftingTables).toBe(1)

    await page.keyboard.press('e')
    await page.waitForTimeout(300)

    await page.evaluate(() => window.__TS_MINECRAFT_QA__?.stageBuildSupportBlock())
    await page.waitForTimeout(200)
    await page.evaluate(() => window.__TS_MINECRAFT_QA__?.selectHotbarSlot(0))
    await page.evaluate(() => window.__TS_MINECRAFT_QA__?.placeSelectedItemInFront())
    await page.waitForTimeout(300)

    const afterBuild = await page.evaluate(() => window.__TS_MINECRAFT_QA__?.getInventorySnapshot() ?? [])
    const remainingTables = afterBuild.reduce((sum: number, slot: { slot: number; itemType: string; count: number } | null) => sum + (slot?.itemType === 'CRAFTING_TABLE' ? slot.count : 0), 0)
    expect(remainingTables).toBe(0)

    await openInventory(page)
    await clickRecipe(page, 'planks-and-sticks-to-wooden-sword')

    const swordAfterPlacedTable = await page.evaluate(() => window.__TS_MINECRAFT_QA__?.getInventorySnapshot() ?? [])
    const movedSword = await page.evaluate(() => window.__TS_MINECRAFT_QA__?.moveItemToHotbar('WOODEN_SWORD', 1) ?? false)
    const swordCount = swordAfterPlacedTable.reduce((sum: number, slot: { slot: number; itemType: string; count: number } | null) => sum + (slot?.itemType === 'WOODEN_SWORD' ? slot.count : 0), 0)
    expect(movedSword).toBe(true)
    expect(swordCount).toBe(1)

    await page.keyboard.press('e')
    await page.waitForTimeout(200)

    await page.evaluate(() => window.__TS_MINECRAFT_QA__?.clearBlocksInFront())
    await page.waitForTimeout(200)
    await page.evaluate(() => window.__TS_MINECRAFT_QA__?.spawnLowHealthZombieInFront())
    await page.waitForTimeout(300)

    await page.evaluate(() => window.__TS_MINECRAFT_QA__?.selectHotbarSlot(1))
    await page.evaluate(() => window.__TS_MINECRAFT_QA__?.aimAtStagedZombie())
    await page.waitForTimeout(100)
    await page.evaluate(() => window.__TS_MINECRAFT_QA__?.attackFirstZombie())
    await page.waitForTimeout(300)

    const entitiesAfterFight = await page.evaluate(() => window.__TS_MINECRAFT_QA__?.getEntitySnapshot() ?? [])
    expect(entitiesAfterFight.some((entity: { entityId: string; type: string }) => entity.type === 'Zombie')).toBe(false)
    expect(getFatalErrors().length).toBe(0)
  })
})
