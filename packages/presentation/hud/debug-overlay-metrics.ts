import { Effect } from 'effect'
import { DEFAULT_PLAYER_ID } from '@ts-minecraft/core'
import type { DebugOverlayDeps } from '@ts-minecraft/presentation/hud/debug-overlay-types'
import { facingFromYaw, formatNumber } from '@ts-minecraft/presentation/hud/debug-overlay-utils'

export type DebugOverlayMetrics = {
  readonly positionText: string
  readonly facingText: string
  readonly biomeText: string
  readonly fpsText: string
  readonly loadedChunksText: string
  readonly timeOfDayText: string
}

export const resolveDebugOverlayMetrics = (
  deps: DebugOverlayDeps,
): Effect.Effect<DebugOverlayMetrics, never> =>
  Effect.gen(function* () {
    const position = yield* deps.gameState.getPlayerPosition(DEFAULT_PLAYER_ID).pipe(
      Effect.catchAll(() => Effect.succeed({ x: 0, y: 0, z: 0 })),
    )
    const rotation = yield* deps.cameraState.getRotation()
    const fps = yield* deps.fpsCounter.getFPS()
    const loadedChunks = yield* deps.chunkManager.getLoadedChunks()
    const timeOfDay = yield* deps.timeService.getTimeOfDay()
    const biome = yield* deps.biomeService.getBiome(Math.floor(position.x), Math.floor(position.z))
    const facing = facingFromYaw(rotation.yaw)

    return {
      positionText: `${formatNumber(position.x, 1)} / ${formatNumber(position.y, 1)} / ${formatNumber(position.z, 1)}`,
      facingText: `${facing.name} (${facing.axis})`,
      biomeText: biome,
      fpsText: formatNumber(fps, 1),
      loadedChunksText: String(loadedChunks.length),
      timeOfDayText: formatNumber(timeOfDay, 3),
    }
  })
