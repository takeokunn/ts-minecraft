import { Effect, Context, Layer } from 'effect'
import { WorldService, WorldError } from '@/domain'
import { WorldId, Position } from '@/shared/kernel'
import { BlockType } from '@/domain/block'

/**
 * Service interface for terrain generation
 */
export interface TerrainService {
  /**
   * Generates a flat world at y=0 with the specified size
   * @param worldId - The world to generate terrain in
   * @param size - The size of the grid (size x size)
   */
  readonly generateFlatWorld: (
    worldId: WorldId,
    size: number
  ) => Effect.Effect<void, WorldError>
}

/**
 * Context tag for TerrainService
 */
export const TerrainService = Context.GenericTag<TerrainService>('@minecraft/application/TerrainService')

/**
 * Live implementation of TerrainService
 * Generates a flat terrain using GRASS blocks at y=0
 */
export const TerrainServiceLive = Layer.effect(
  TerrainService,
  Effect.gen(function* () {
    const worldService = yield* WorldService

    return TerrainService.of({
      generateFlatWorld: (worldId, size) =>
        Effect.gen(function* () {
          const halfSize = Math.floor(size / 2)

          for (let x = -halfSize; x < halfSize; x++) {
            for (let z = -halfSize; z < halfSize; z++) {
              const position: Position = { x, y: 0, z }
              yield* worldService.addBlock(worldId, position, 'GRASS' as BlockType)
            }
          }
        }),
    })
  })
)
