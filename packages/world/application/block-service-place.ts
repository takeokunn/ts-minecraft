import { Effect, Either, Metric } from 'effect'
import {
  DEFAULT_PLAYER_ID,
  type InventoryItem,
  type Position,
  type SlotIndex,
} from '@ts-minecraft/core'
import { blockOverlapsPlayer, worldToBlockLocal } from '../domain/block-utils'
import { toDirtyVoxels } from '../domain/placed-block'
import { BlockServiceError } from './block-service-error'
import {
  mapBlockReadError,
  mapChunkLoadError,
  type PlaceBlockDeps,
  validateBlockType,
} from './block-service-place-helpers'
import { buildPlacedBlocks } from './block-service-place-plan'
import {
  notifyPlacedBlocks,
  rollbackPlacedBlocks,
  writePlacedBlocks,
} from './block-service-place-effects'

export const makePlaceBlock =
  (deps: PlaceBlockDeps) =>
  (
    position: Position,
    itemType: InventoryItem,
    preferredInventorySlot?: SlotIndex,
  ): Effect.Effect<void, BlockServiceError> =>
    Effect.gen(function* () {
      const operation = 'placeBlock'
      const { chunkCoord, lx, lz, y } = worldToBlockLocal(position)

      const chunk = yield* deps.chunkManagerService
        .getChunk(chunkCoord)
        .pipe(Effect.mapError(mapChunkLoadError(chunkCoord, operation)))

      const existing = yield* deps.chunkService
        .getBlock(chunk, lx, y, lz)
        .pipe(
          Effect.mapError(
            mapBlockReadError(
              operation,
              `Failed to read block at local (${lx}, ${y}, ${lz})`,
            ),
          ),
        )

      if (existing !== 'AIR') {
        return yield* Effect.fail(
          new BlockServiceError({
            operation,
            reason: `Block already exists at position (${position.x}, ${position.y}, ${position.z})`,
          }),
        )
      }

      const blockType = yield* validateBlockType(itemType, operation)
      const placedBlocks = yield* buildPlacedBlocks(
        deps.chunkService,
        chunk,
        blockType,
        position,
        lx,
        y,
        lz,
        operation,
      )

      const playerPos = yield* deps.playerService
        .getPosition(DEFAULT_PLAYER_ID)
        .pipe(
          Effect.mapError(
            (e) =>
              new BlockServiceError({
                operation,
                reason: `Player position error: ${e.message}`,
                cause: e,
              }),
          ),
        )

      if (
        placedBlocks.some((block) =>
          blockOverlapsPlayer(block.position, playerPos),
        )
      ) {
        return yield* Effect.fail(
          new BlockServiceError({
            operation,
            reason: 'Cannot place block inside player',
          }),
        )
      }

      yield* writePlacedBlocks(chunk, placedBlocks, blockType, operation)

      const removeResult = yield* deps.inventoryService
        .removeBlock(blockType, 1, preferredInventorySlot)
        .pipe(Effect.either)
      if (Either.isLeft(removeResult)) {
        yield* rollbackPlacedBlocks(chunk, placedBlocks, operation)
        return yield* Effect.fail(
          new BlockServiceError({
            operation,
            reason: `No ${blockType} available in inventory`,
          }),
        )
      }

      const dirtyVoxels = toDirtyVoxels(placedBlocks)
      yield* deps.chunkManagerService.markChunkDirty(chunkCoord, dirtyVoxels)
      yield* notifyPlacedBlocks(deps.fluidService, placedBlocks)
      if (blockType === 'WATER') yield* deps.fluidService.seedWater(position)
      if (blockType === 'LAVA') yield* deps.fluidService.seedLava(position)
      yield* Metric.increment(Metric.counter('blocks_placed'))
    })
