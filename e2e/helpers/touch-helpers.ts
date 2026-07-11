import type { PlaywrightTestArgs } from '@playwright/test'

type Page = PlaywrightTestArgs['page']
type CDPSession = Awaited<ReturnType<ReturnType<Page['context']>['newCDPSession']>>

export const MOBILE_VIEWPORT = { width: 844, height: 390 } as const

export async function enableTouchEmulation(page: Page): Promise<CDPSession> {
  await page.setViewportSize(MOBILE_VIEWPORT)
  const client = await page.context().newCDPSession(page)
  await client.send('Emulation.setTouchEmulationEnabled', {
    enabled: true,
    maxTouchPoints: 5,
  })
  return client
}

type Point = Readonly<{ x: number; y: number }>

export async function touchGesture(
  client: CDPSession,
  points: ReadonlyArray<Point>,
  holdMs = 0,
): Promise<void> {
  if (points.length === 0) throw new Error('A touch gesture needs at least one point')

  const first = points[0]!
  const moves = points.slice(1)
  await client.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x: first.x, y: first.y, id: 1, radiusX: 8, radiusY: 8 }],
  })

  for (const point of moves) {
    await client.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x: point.x, y: point.y, id: 1, radiusX: 8, radiusY: 8 }],
    })
    await pageDelay(client, 32)
  }

  if (holdMs > 0) await pageDelay(client, holdMs)
  await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
}

export async function tapLocator(page: Page, client: CDPSession, selector: string): Promise<void> {
  const locator = page.locator(selector)
  await locator.waitFor({ state: 'visible' })
  const box = await locator.boundingBox()
  if (box === null) throw new Error(`Cannot tap ${selector}: it has no bounding box`)
  await touchGesture(client, [{ x: box.x + box.width / 2, y: box.y + box.height / 2 }], 60)
}

export async function gestureOnLocator(
  page: Page,
  client: CDPSession,
  selector: string,
  relativePoints: ReadonlyArray<Point>,
  holdMs = 0,
): Promise<void> {
  const locator = page.locator(selector)
  await locator.waitFor({ state: 'visible' })
  const box = await locator.boundingBox()
  if (box === null) throw new Error(`Cannot gesture on ${selector}: it has no bounding box`)

  await touchGesture(
    client,
    relativePoints.map((point) => ({ x: box.x + point.x * box.width, y: box.y + point.y * box.height })),
    holdMs,
  )
}

async function pageDelay(client: CDPSession, durationMs: number): Promise<void> {
  await client.send('Runtime.evaluate', {
    expression: `new Promise((resolve) => setTimeout(resolve, ${durationMs}))`,
    awaitPromise: true,
  })
}
