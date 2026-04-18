import { test, expect, type Page } from '@playwright/test'
import { GamePage } from '../fixtures/game-page'
import { attachFatalErrorMonitor } from '../helpers/console-monitor'
import { waitForStableRender } from '../helpers/wait-helpers'

async function openInventory(page: Page): Promise<void> {
  await page.evaluate(() => (window as typeof window & { __TS_MINECRAFT_QA__?: { openInventoryForQA: () => Promise<void> } }).__TS_MINECRAFT_QA__?.openInventoryForQA())
  await page.waitForFunction(() => {
    const overlay = document.getElementById('inventory-overlay')
    return overlay instanceof HTMLDivElement && getComputedStyle(overlay).display !== 'none'
  }, { timeout: 5_000 })
}

async function clickRecipe(page: Page, recipeId: string): Promise<void> {
  await page.waitForFunction((id) => {
    const button = document.querySelector(`[data-recipe-id="${id}"]`)
    return button instanceof HTMLButtonElement
  }, recipeId, { timeout: 5_000 })

  await page.evaluate((id) => {
    const button = document.querySelector(`[data-recipe-id="${id}"]`)
    if (button instanceof HTMLButtonElement) button.click()
  }, recipeId)

  await page.waitForTimeout(100)
}

async function waitForRuntimeReady(page: Page): Promise<void> {
  await page.waitForSelector('#game-canvas', { timeout: 30_000 })
  await page.waitForSelector('#crosshair', { state: 'attached', timeout: 30_000 })
  await page.waitForSelector('#settings-overlay', { state: 'attached', timeout: 30_000 })
}

test.describe('Progression loop', () => {
  test('supports gather → craft → build → fight through the runtime loop', async ({ page }) => {
    const getFatalErrors = attachFatalErrorMonitor(page)
    const game = new GamePage(page)

    await game.goto()
    await waitForRuntimeReady(page)
    await waitForStableRender(page, 1_000)

    await page.evaluate(() => (window as typeof window & { __TS_MINECRAFT_QA__?: { stageProgressionScenario: () => Promise<void>; collectStagedResources: () => Promise<void> } }).__TS_MINECRAFT_QA__?.stageProgressionScenario())
    await page.evaluate(() => (window as typeof window & { __TS_MINECRAFT_QA__?: { collectStagedResources: () => Promise<void> } }).__TS_MINECRAFT_QA__?.collectStagedResources())
    await page.waitForTimeout(300)

    const afterGather = await page.evaluate(() =>
      (window as typeof window & { __TS_MINECRAFT_QA__?: { getInventorySnapshot: () => Promise<Array<{ slot: number; blockType: string; count: number } | null>> } }).__TS_MINECRAFT_QA__?.getInventorySnapshot() ?? []
    )
    const gatheredWood = afterGather.reduce((sum, slot) => sum + (slot?.blockType === 'WOOD' ? slot.count : 0), 0)
    expect(gatheredWood).toBeGreaterThanOrEqual(3)

    await openInventory(page)
    await clickRecipe(page, 'wood-to-planks')
    await clickRecipe(page, 'wood-to-planks')
    await clickRecipe(page, 'wood-to-planks')
    await clickRecipe(page, 'planks-to-sticks')
    await clickRecipe(page, 'planks-to-crafting-table')
    await clickRecipe(page, 'planks-and-sticks-to-wooden-sword')

    const moved = await page.evaluate(async () => {
      const qa = (window as typeof window & { __TS_MINECRAFT_QA__?: { moveItemToHotbar: (blockType: string, hotbarIndex: number) => Promise<boolean>; getInventorySnapshot: () => Promise<Array<{ slot: number; blockType: string; count: number } | null>> } }).__TS_MINECRAFT_QA__
      if (!qa) return { movedTable: false, movedSword: false, craftingTables: 0, swords: 0 }
      const movedTable = await qa.moveItemToHotbar('CRAFTING_TABLE', 0)
      const movedSword = await qa.moveItemToHotbar('WOODEN_SWORD', 1)
      const snapshot = await qa.getInventorySnapshot()
      return {
        movedTable,
        movedSword,
        craftingTables: snapshot.reduce((sum, slot) => sum + (slot?.blockType === 'CRAFTING_TABLE' ? slot.count : 0), 0),
        swords: snapshot.reduce((sum, slot) => sum + (slot?.blockType === 'WOODEN_SWORD' ? slot.count : 0), 0),
      }
    })
    expect(moved.movedTable).toBe(true)
    expect(moved.movedSword).toBe(true)
    expect(moved.craftingTables).toBe(1)
    expect(moved.swords).toBe(1)

    await page.keyboard.press('e')
    await page.waitForTimeout(300)

    await page.evaluate(() => (window as typeof window & { __TS_MINECRAFT_QA__?: { selectHotbarSlot: (index: number) => Promise<void> } }).__TS_MINECRAFT_QA__?.selectHotbarSlot(0))
    await page.evaluate(() => (window as typeof window & { __TS_MINECRAFT_QA__?: { placeSelectedItemInFront: () => Promise<void> } }).__TS_MINECRAFT_QA__?.placeSelectedItemInFront())
    await page.waitForTimeout(300)

    const afterBuild = await page.evaluate(() =>
      (window as typeof window & { __TS_MINECRAFT_QA__?: { getInventorySnapshot: () => Promise<Array<{ slot: number; blockType: string; count: number } | null>> } }).__TS_MINECRAFT_QA__?.getInventorySnapshot() ?? []
    )
    const remainingTables = afterBuild.reduce((sum, slot) => sum + (slot?.blockType === 'CRAFTING_TABLE' ? slot.count : 0), 0)
    expect(remainingTables).toBe(0)

    await page.evaluate(() => (window as typeof window & { __TS_MINECRAFT_QA__?: { clearBlocksInFront: () => Promise<void>; spawnLowHealthZombieInFront: () => Promise<void> } }).__TS_MINECRAFT_QA__?.clearBlocksInFront())
    await page.waitForTimeout(200)
    await page.evaluate(() => (window as typeof window & { __TS_MINECRAFT_QA__?: { spawnLowHealthZombieInFront: () => Promise<void> } }).__TS_MINECRAFT_QA__?.spawnLowHealthZombieInFront())
    await page.waitForTimeout(300)

    await page.evaluate(() => (window as typeof window & { __TS_MINECRAFT_QA__?: { selectHotbarSlot: (index: number) => Promise<void> } }).__TS_MINECRAFT_QA__?.selectHotbarSlot(1))
    await page.evaluate(() => (window as typeof window & { __TS_MINECRAFT_QA__?: { attackFirstZombie: () => Promise<boolean> } }).__TS_MINECRAFT_QA__?.attackFirstZombie())
    await page.waitForTimeout(300)

    const entitiesAfterFight = await page.evaluate(() =>
      (window as typeof window & { __TS_MINECRAFT_QA__?: { getEntitySnapshot: () => Promise<Array<{ type: string }>> } }).__TS_MINECRAFT_QA__?.getEntitySnapshot() ?? []
    )
    expect(entitiesAfterFight.some((entity) => entity.type === 'Zombie')).toBe(false)
    expect(getFatalErrors()).toHaveLength(0)
  })
})
