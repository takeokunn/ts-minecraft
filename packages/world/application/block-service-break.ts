import { Effect } from 'effect'
import { type Position } from '@ts-minecraft/core'
import { worldToBlockLocal } from '../domain/block-utils'
import { BlockServiceError } from './block-service-error'
import {
  applyBreakBlock,
  mapBlockReadError,
  mapChunkLoadError,
  type BreakBlockDeps,
  type BreakBlockOptions,
} from './block-service-break-helpers'

export const makeBreakBlock =
  (deps: BreakBlockDeps) =>
  (
    position: Position,
    silkTouch = false,
    options?: BreakBlockOptions,
  ): Effect.Effect<void, BlockServiceError> =>
    Effect.gen(function* () {
      const requireHarvest = options?.requireHarvest ?? true
      const dropItems = options?.dropItems ?? true
      const { chunkCoord, lx, lz, y } = worldToBlockLocal(position)

      const chunk = yield* deps.chunkManagerService.getChunk(chunkCoord).pipe(
        Effect.mapError(mapChunkLoadError(chunkCoord)),
      )

      const blockType = yield* deps.chunkService.getBlock(chunk, lx, y, lz).pipe(
        Effect.mapError(mapBlockReadError(lx, y, lz)),
      )

      if (blockType === 'AIR') {
        return yield* Effect.fail(new BlockServiceError({
          operation: 'breakBlock',
          reason: `No block at position (${position.x}, ${position.y}, ${position.z})`,
        }))
      }

      yield* applyBreakBlock(deps, {
        position,
        chunkCoord,
        chunk,
        lx,
        y,
        lz,
        blockType,
        silkTouch,
        requireHarvest,
        dropItems,
      })
    })
