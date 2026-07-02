import { Effect } from 'effect'
import type { Position, ChunkCoord } from '@ts-minecraft/core'
import { isInWater } from '@ts-minecraft/game/domain/block-collision-predicates'
import { worldToChunkCoord } from '@ts-minecraft/world/domain/chunk-coord-utils'
import type { FrameHandlerDeps } from '@ts-minecraft/app/application/frame/types/deps'
import type { FrameHandlerServices } from '@ts-minecraft/app/application/frame/types/services'

export type UnderwaterChunkCacheEntry = { readonly blocks: Uint8Array } | null

export const getPlayerChunkCoord = (position: Position): ChunkCoord => worldToChunkCoord(position)

export const buildPlayerUnderwaterChunkCache = (
  services: Pick<FrameHandlerServices, 'chunkManagerService'>,
  playerChunkCoord: ChunkCoord,
): Effect.Effect<ReadonlyArray<UnderwaterChunkCacheEntry>, never> =>
  Effect.gen(function* () {
    const chunkCache = Array.from({ length: 9 }) as Array<UnderwaterChunkCacheEntry>
    let index = 0

    for (let dx = -1; dx <= 1; dx += 1) {
      for (let dz = -1; dz <= 1; dz += 1) {
        const chunk = yield* services.chunkManagerService
          .getChunk({ x: playerChunkCoord.x + dx, z: playerChunkCoord.z + dz })
          .pipe(Effect.catchAll(() => Effect.succeed(null)))
        chunkCache[index] = chunk
        index += 1
      }
    }

    return chunkCache
  })

export const getPlayerUnderwater = (
  deps: Pick<FrameHandlerDeps, 'camera'>,
  services: Pick<FrameHandlerServices, 'chunkManagerService'>,
): Effect.Effect<boolean, never> => {
  const playerChunkCoord = getPlayerChunkCoord(deps.camera.position)

  return Effect.gen(function* () {
    const chunkCache = yield* buildPlayerUnderwaterChunkCache(services, playerChunkCoord)
    return isInWater(
      deps.camera.position.x,
      deps.camera.position.y,
      deps.camera.position.z,
      chunkCache,
      playerChunkCoord.x,
      playerChunkCoord.z,
    )
  })
}
