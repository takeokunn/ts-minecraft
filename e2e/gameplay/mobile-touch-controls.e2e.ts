import { expect, test } from '@playwright/test'
import { GamePage } from '../fixtures/game-page'
import { attachFatalErrorMonitor } from '../helpers/console-monitor'
import {
  enableTouchEmulation,
  gestureOnLocator,
  MOBILE_VIEWPORT,
  tapLocator,
} from '../helpers/touch-helpers'

const control = (name: string): string => `[data-touch-control="${name}"]`

test.describe('Mobile touch controls', () => {
  test('controls fit the safe viewport and expose touch-sized targets', async ({ page }) => {
    const client = await enableTouchEmulation(page)
    const game = new GamePage(page)
    await game.goto()
    await game.waitForReady()

    const controls = page.locator('[data-touch-controls]')
    await expect(controls).toBeVisible()

    for (const name of ['jump', 'break', 'use', 'sneak', 'sprint', 'inventory', 'pause']) {
      const target = page.locator(control(name))
      await expect(target).toBeVisible()
      const box = await target.boundingBox()
      expect(box, `${name} must have a layout box`).not.toBeNull()
      expect(box!.width, `${name} width`).toBeGreaterThanOrEqual(48)
      expect(box!.height, `${name} height`).toBeGreaterThanOrEqual(48)
      expect(box!.x, `${name} left edge`).toBeGreaterThanOrEqual(0)
      expect(box!.y, `${name} top edge`).toBeGreaterThanOrEqual(0)
      expect(box!.x + box!.width, `${name} right edge`).toBeLessThanOrEqual(MOBILE_VIEWPORT.width)
      expect(box!.y + box!.height, `${name} bottom edge`).toBeLessThanOrEqual(MOBILE_VIEWPORT.height)
    }

    await client.detach()
  })

  test('inventory and pause are operable without a keyboard', async ({ page }) => {
    const getFatalErrors = attachFatalErrorMonitor(page)
    const client = await enableTouchEmulation(page)
    const game = new GamePage(page)
    await game.goto()
    await game.waitForReady()

    await tapLocator(page, client, control('inventory'))
    await expect(page.locator('#inventory-overlay')).toBeVisible()
    await tapLocator(page, client, control('inventory'))
    await expect(page.locator('#inventory-overlay')).toBeHidden()

    await tapLocator(page, client, control('pause'))
    await expect(page.locator('#pause-menu-backdrop')).toBeVisible()
    await page.locator('[data-role="resume"]').click()
    await expect(page.locator('#pause-menu-backdrop')).toBeHidden()

    expect(getFatalErrors().length).toBe(0)
    await client.detach()
  })

  test('look gesture rotates the camera and releases cleanly', async ({ page }) => {
    const getFatalErrors = attachFatalErrorMonitor(page)
    const client = await enableTouchEmulation(page)
    const game = new GamePage(page)
    await game.goto()
    await game.waitForReady()

    const readDirection = () => page.evaluate(() => {
      const snapshot = window.__TS_MINECRAFT_QA__?.getRenderingSnapshot()
      if (snapshot === undefined) return null
      return {
        x: snapshot.camera.forwardX,
        y: snapshot.camera.forwardY,
        z: snapshot.camera.forwardZ,
      }
    })

    const before = await readDirection()
    expect(before).not.toBeNull()

    await gestureOnLocator(page, client, control('look'), [
      { x: 0.35, y: 0.5 },
      { x: 0.55, y: 0.5 },
      { x: 0.75, y: 0.5 },
    ])
    await page.waitForTimeout(200)

    const after = await readDirection()
    expect(after).not.toBeNull()
    const rotationDelta = Math.hypot(
      after!.x - before!.x,
      after!.y - before!.y,
      after!.z - before!.z,
    )
    expect(rotationDelta > 0.01).toBe(true)

    await page.waitForTimeout(300)
    const settled = await readDirection()
    expect(settled).toEqual(after)
    expect(getFatalErrors().length).toBe(0)
    await client.detach()
  })
})
