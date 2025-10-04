/**
 * Coordinate Transform Service - 座標変換ドメインサービス
 */

import { Context, Effect, Layer } from 'effect'
import type { GenerationError } from '../../types/errors/generation_errors.js'
import type { WorldCoordinate3D } from '../../value_object/coordinates/world_coordinate.js'

export interface CoordinateTransformService {
  readonly worldToChunk: (
    coord: WorldCoordinate3D
  ) => Effect.Effect<
    { chunkX: number; chunkZ: number; localX: number; localY: number; localZ: number },
    GenerationError
  >
  readonly chunkToWorld: (
    chunkX: number,
    chunkZ: number,
    localX: number,
    localY: number,
    localZ: number
  ) => Effect.Effect<WorldCoordinate3D, GenerationError>
}

export const CoordinateTransformService = Context.GenericTag<CoordinateTransformService>(
  '@minecraft/domain/world/CoordinateTransform'
)

export const CoordinateTransformServiceLive = Layer.effect(
  CoordinateTransformService,
  Effect.succeed({
    worldToChunk: (coord) =>
      Effect.succeed({
        chunkX: Math.floor(coord.x / 16),
        chunkZ: Math.floor(coord.z / 16),
        localX: coord.x % 16,
        localY: coord.y,
        localZ: coord.z % 16,
      }),
    chunkToWorld: (chunkX, chunkZ, localX, localY, localZ) =>
      Effect.succeed({
        x: chunkX * 16 + localX,
        y: localY,
        z: chunkZ * 16 + localZ,
      } as WorldCoordinate3D),
  })
)
