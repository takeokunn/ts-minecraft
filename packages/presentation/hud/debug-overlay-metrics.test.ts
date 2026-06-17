import { Effect } from 'effect'
import { describe, expect, it } from '@effect/vitest'
import type { DebugOverlayDeps } from '@ts-minecraft/presentation/hud/debug-overlay-types'
import { resolveDebugOverlayMetrics } from '@ts-minecraft/presentation/hud/debug-overlay-metrics'

const makeDeps = (overrides: Partial<DebugOverlayDeps> = {}): DebugOverlayDeps => ({
  biomeService: {
    getBiome: () => Effect.succeed('Mesa'),
  } as DebugOverlayDeps['biomeService'],
  chunkManager: {
    getLoadedChunks: () => Effect.succeed([{} as never, {} as never]),
  } as DebugOverlayDeps['chunkManager'],
  gameState: {
    getPlayerPosition: () => Effect.fail(new Error('missing player')),
  } as DebugOverlayDeps['gameState'],
  timeService: {
    getTimeOfDay: () => Effect.succeed(123.4567),
  } as DebugOverlayDeps['timeService'],
  cameraState: {
    getRotation: () => Effect.succeed({ yaw: 45, pitch: 0 }),
  } as DebugOverlayDeps['cameraState'],
  fpsCounter: {
    getFPS: () => Effect.succeed(61.2),
  } as DebugOverlayDeps['fpsCounter'],
  debugFeatureFlags: {} as DebugOverlayDeps['debugFeatureFlags'],
  ...overrides,
})

describe('resolveDebugOverlayMetrics', () => {
  it('formats the overlay text and falls back to origin position', () => {
    const metrics = Effect.runSync(resolveDebugOverlayMetrics(makeDeps()))

    expect(metrics).toEqual({
      positionText: '0.0 / 0.0 / 0.0',
      facingText: 'west (Towards negative X)',
      biomeText: 'Mesa',
      fpsText: '61.2',
      loadedChunksText: '2',
      timeOfDayText: '123.457',
    })
  })

  it('uses the real position when available', () => {
    const metrics = Effect.runSync(
      resolveDebugOverlayMetrics(
        makeDeps({
          gameState: {
            getPlayerPosition: () => Effect.succeed({ x: 12.34, y: 56.78, z: -9.01 }),
          } as DebugOverlayDeps['gameState'],
          cameraState: {
            getRotation: () => Effect.succeed({ yaw: 200, pitch: 0 }),
          } as DebugOverlayDeps['cameraState'],
          biomeService: {
            getBiome: () => Effect.succeed('Plains'),
          } as DebugOverlayDeps['biomeService'],
        }),
      ),
    )

    expect(metrics.positionText).toBe('12.3 / 56.8 / -9.0')
    expect(metrics.facingText).toBe('east (Towards positive X)')
    expect(metrics.biomeText).toBe('Plains')
  })
})
