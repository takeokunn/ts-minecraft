import { Effect } from 'effect'
import { WorldService, WorldError } from '@/domain'
import { WorldId, Position } from '@/shared/kernel'
import { BlockType } from '@/domain/block'

/**
 * Service interface for terrain generation
 */
export class TerrainService extends Effect.Service<TerrainService>()(
  '@minecraft/application/TerrainService',
  {
    effect: Effect.gen(function* () {
      const worldService = yield* WorldService

      const generateFlatWorld = (
        worldId: WorldId,
        size: number
      ): Effect.Effect<void, WorldError> =>
        Effect.gen(function* () {
          const halfSize = Math.floor(size / 2)

          for (let x = -halfSize; x < halfSize; x++) {
            for (let z = -halfSize; z < halfSize; z++) {
              const position: Position = { x, y: 0, z }
              yield* worldService.addBlock(worldId, position, 'GRASS' as BlockType)
            }
          }
        })

      return { generateFlatWorld }
    }),
  }
) {}

export const TerrainServiceLive = TerrainService.Default
