import { Effect, Option } from 'effect'
import { CHUNK_SIZE, type Position } from '@ts-minecraft/core'
import type { ChunkManagerService, Dimension } from '@ts-minecraft/world'
import { resolveMobSpawnPosition, resolveNetherSpawnPosition } from '../../domain/mob/terrain-spawn'

export type ChunkManagerServiceLike = Pick<ChunkManagerService, 'getChunk'>

export const makeTerrainAwareSpawnResolver = (
  chunkManagerService: ChunkManagerServiceLike,
  isNightSpawn: boolean,
  dimension: Dimension = 'overworld',
) =>
  (candidatePosition: Position): Effect.Effect<Option.Option<Position>, never> =>
    Effect.gen(function* () {
      const chunkCoord = {
        x: Math.floor(Math.floor(candidatePosition.x) / CHUNK_SIZE),
        z: Math.floor(Math.floor(candidatePosition.z) / CHUNK_SIZE),
      }
      const chunk = yield* chunkManagerService.getChunk(chunkCoord)
      // The roofed nether needs the cavern-pocket scan; the overworld and the
      // open-sky end islands use the top-down surface scan.
      return dimension === 'nether'
        ? resolveNetherSpawnPosition(chunk, candidatePosition)
        : resolveMobSpawnPosition(chunk, candidatePosition, isNightSpawn)
    }).pipe(
      Effect.catchAllCause(() => Effect.succeed(Option.none<Position>())),
    )
