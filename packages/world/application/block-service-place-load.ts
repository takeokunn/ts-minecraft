import { Effect } from 'effect'
import { worldToBlockLocal } from '../domain/block-utils'
import { BlockServiceError } from './block-service-error'
import {
  mapBlockReadError,
  mapChunkLoadError,
  type PlaceBlockDeps,
} from './block-service-place-helpers'
import type {
  PlaceBlockRequest,
  PlaceBlockTarget,
} from './block-service-place-model'

export const loadPlaceBlockTarget = (
  deps: PlaceBlockDeps,
  request: PlaceBlockRequest,
): Effect.Effect<PlaceBlockTarget, BlockServiceError> =>
  Effect.gen(function* () {
    const { chunkCoord, lx, lz, y } = worldToBlockLocal(request.position)
    const chunk = yield* deps.chunkManagerService
      .getChunk(chunkCoord)
      .pipe(Effect.mapError(mapChunkLoadError(chunkCoord, request.operation)))

    return {
      operation: request.operation,
      position: request.position,
      chunkCoord,
      chunk,
      lx,
      y,
      lz,
    }
  })

export const ensurePlacementTargetIsAir = (
  deps: PlaceBlockDeps,
  target: PlaceBlockTarget,
): Effect.Effect<void, BlockServiceError> =>
  deps.chunkService
    .getBlock(target.chunk, target.lx, target.y, target.lz)
    .pipe(
      Effect.mapError(
        mapBlockReadError(
          target.operation,
          `Failed to read block at local (${target.lx}, ${target.y}, ${target.lz})`,
        ),
      ),
      Effect.flatMap((existing) =>
        existing === 'AIR'
          ? Effect.void
          : Effect.fail(
              new BlockServiceError({
                operation: target.operation,
                reason: `Block already exists at position (${target.position.x}, ${target.position.y}, ${target.position.z})`,
              }),
            ),
      ),
    )
