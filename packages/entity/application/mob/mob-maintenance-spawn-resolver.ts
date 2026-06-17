import { Effect, Option } from 'effect'
import { CHUNK_SIZE, type Position } from '@ts-minecraft/core'
import type { ChunkManagerService } from '@ts-minecraft/world'
import { resolveMobSpawnPosition } from '../../domain/mob/terrain-spawn'

export type ChunkManagerServiceLike = Pick<ChunkManagerService, 'getChunk'>

export const makeTerrainAwareSpawnResolver = (
  chunkManagerService: ChunkManagerServiceLike,
  isNightSpawn: boolean,
) =>
  (candidatePosition: Position): Effect.Effect<Option.Option<Position>, never> =>
    Effect.gen(function* () {
      const chunkCoord = {
        x: Math.floor(Math.floor(candidatePosition.x) / CHUNK_SIZE),
        z: Math.floor(Math.floor(candidatePosition.z) / CHUNK_SIZE),
      }
      const chunk = yield* chunkManagerService.getChunk(chunkCoord)
      return resolveMobSpawnPosition(chunk, candidatePosition, isNightSpawn)
    }).pipe(
      Effect.catchAllCause(() => Effect.succeed(Option.none<Position>())),
    )
