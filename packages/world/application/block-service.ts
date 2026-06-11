import { Context, Effect, Data, Either, HashSet, Metric, Schema } from 'effect'
import { ChunkManagerService } from './chunk-manager-service'
import { DEFAULT_PLAYER_ID } from '@ts-minecraft/core'
import { FluidService } from './fluid-service'
import { BlockIndexError } from '@ts-minecraft/core'
import { ChunkService } from './chunk-service'
import { setBlockInChunk } from '../domain/chunk'
import { worldToBlockLocal, blockOverlapsPlayer, canHarvestBlock } from './block-utils'
export { worldToBlockLocal, blockOverlapsPlayer } from './block-utils'
import { PlayerService } from '@ts-minecraft/entity/application/player-service'
import { InventoryService } from '@ts-minecraft/inventory/application/inventory-service'
import { HotbarService } from '@ts-minecraft/inventory/application/hotbar-service'
import type { FurnaceService } from '@ts-minecraft/inventory/application/furnace-service'
import { BlockTypeSchema } from '@ts-minecraft/core'
import type { BlockType, InventoryItem } from '@ts-minecraft/core'
import { Position, SlotIndex } from '@ts-minecraft/core'
import {
  NON_PLACEABLE_ITEM_TYPES,
  DIAMOND_PICKAXE_HARVESTABLE_BLOCKS,
  getInventoryDropForBlock,
  getBlockDropCount,
} from './block-service.config'

const REQUIRES_PICKAXE_BLOCKS = DIAMOND_PICKAXE_HARVESTABLE_BLOCKS

const FurnaceServiceTag = Context.GenericTag<FurnaceService>('@minecraft/application/FurnaceService')

// ─── Error type ───────────────────────────────────────────────────────────────

export class BlockServiceError extends Data.TaggedError('BlockServiceError')<{
  readonly operation: string
  readonly reason: string
  readonly cause?: unknown
}> {
  override get message(): string {
    const causeStr = this.cause instanceof Error ? this.cause.message : this.cause ? String(this.cause) : ''
    return `BlockService error during ${this.operation}: ${this.reason}${causeStr ? `: ${causeStr}` : ''}`
  }
}

// ─── Service ─────────────────────────────────────────────────────────────────

export class BlockService extends Effect.Service<BlockService>()(
  '@minecraft/application/BlockService',
  {
    effect: Effect.suspend(() => Effect.all([
      ChunkManagerService,
      ChunkService,
      FluidService,
      PlayerService,
      InventoryService,
      HotbarService,
      FurnaceServiceTag,
    ], { concurrency: 'unbounded' }).pipe(
      Effect.map(([chunkManagerService, chunkService, fluidService, playerService, inventoryService, hotbarService, furnaceService]) => ({

        breakBlock: (position: Position, silkTouch = false): Effect.Effect<void, BlockServiceError> =>
          Effect.gen(function* () {
            const { chunkCoord, lx, lz } = worldToBlockLocal(position)
            const y = Math.floor(position.y)

            const chunk = yield* chunkManagerService.getChunk(chunkCoord).pipe(
              Effect.mapError((e) => new BlockServiceError({
                operation: 'breakBlock',
                reason: `Failed to load chunk at (${chunkCoord.x}, ${chunkCoord.z}): ${e.message}`,
                cause: e,
              }))
            )

            const blockType = yield* chunkService.getBlock(chunk, lx, y, lz).pipe(
              Effect.mapError((e) => new BlockServiceError({
                operation: 'breakBlock',
                reason: `Failed to read block at local (${lx}, ${y}, ${lz}): ${e.message}`,
                cause: e,
              }))
            )

            if (blockType === 'AIR') {
              return yield* Effect.fail(new BlockServiceError({
                operation: 'breakBlock',
                reason: `No block at position (${position.x}, ${position.y}, ${position.z})`,
              }))
            }

            const selectedTool = yield* hotbarService.getSelectedBlockType()
            const shouldDrop = canHarvestBlock(blockType, selectedTool)
            if (HashSet.has(REQUIRES_PICKAXE_BLOCKS, blockType) && !shouldDrop) {
              return yield* Effect.fail(new BlockServiceError({
                operation: 'breakBlock',
                reason: `Block requires a stronger pickaxe: ${blockType}`,
              }))
            }

            if (blockType === 'FURNACE') {
              const dismantled = yield* furnaceService.dismantleFurnace(position)
              if (!dismantled) {
                return yield* Effect.fail(new BlockServiceError({
                  operation: 'breakBlock',
                  reason: 'Cannot break furnace while its contents cannot fit in inventory',
                }))
              }
            }

            yield* setBlockInChunk(chunk, lx, y, lz, 'AIR').pipe(
              /* c8 ignore next 4 */
              Effect.mapError((e: BlockIndexError) => new BlockServiceError({
                operation: 'breakBlock',
                reason: `Block coordinates out of bounds: (${e.x}, ${e.y}, ${e.z})`,
                cause: e,
              }))
            )

            yield* chunkManagerService.markChunkDirty(chunkCoord, [{ lx, y, lz }])
            if (blockType === 'WATER') yield* fluidService.removeWater(position)
            if (blockType === 'LAVA') yield* fluidService.removeLava(position)
            yield* fluidService.notifyBlockChanged(position)
            yield* Metric.increment(Metric.counter('blocks_broken'))
            if (shouldDrop) {
              // SILK_TOUCH: drop the block itself (count=1) instead of its processed item drop.
              const dropItem = silkTouch ? (blockType as InventoryItem) : getInventoryDropForBlock(blockType)
              const dropCount = silkTouch ? 1 : getBlockDropCount(blockType)
              yield* inventoryService.addBlock(dropItem, dropCount).pipe(Effect.catchAllCause(() => Effect.void))
            }
          }),

        placeBlock: (position: Position, itemType: InventoryItem, preferredInventorySlot?: SlotIndex): Effect.Effect<void, BlockServiceError> =>
          Effect.gen(function* () {
            const { chunkCoord, lx, lz } = worldToBlockLocal(position)
            const y = Math.floor(position.y)

            const chunk = yield* chunkManagerService.getChunk(chunkCoord).pipe(
              Effect.mapError((e) => new BlockServiceError({
                operation: 'placeBlock',
                reason: `Failed to load chunk at (${chunkCoord.x}, ${chunkCoord.z}): ${e.message}`,
                cause: e,
              }))
            )

            const existing = yield* chunkService.getBlock(chunk, lx, y, lz).pipe(
              Effect.mapError((e) => new BlockServiceError({
                operation: 'placeBlock',
                reason: `Failed to read block at local (${lx}, ${y}, ${lz}): ${e.message}`,
                cause: e,
              }))
            )

            if (existing !== 'AIR') {
              return yield* Effect.fail(new BlockServiceError({
                operation: 'placeBlock',
                reason: `Block already exists at position (${position.x}, ${position.y}, ${position.z})`,
              }))
            }

            if (HashSet.has(NON_PLACEABLE_ITEM_TYPES, itemType)) {
              return yield* Effect.fail(new BlockServiceError({
                operation: 'placeBlock',
                reason: `${itemType} is an inventory item and cannot be placed in the world`,
              }))
            }

            const decodedBlockType = Schema.decodeUnknownEither(BlockTypeSchema)(itemType)
            if (Either.isLeft(decodedBlockType)) {
              return yield* Effect.fail(new BlockServiceError({
                operation: 'placeBlock',
                reason: `${itemType} cannot be placed in the world`,
              }))
            }
            const blockType = decodedBlockType.right

            const playerPos = yield* playerService.getPosition(DEFAULT_PLAYER_ID).pipe(
              Effect.mapError((e) => new BlockServiceError({
                operation: 'placeBlock',
                reason: `Player position error: ${e.message}`,
                cause: e,
              }))
            )

            if (blockOverlapsPlayer(position, playerPos)) {
              return yield* Effect.fail(new BlockServiceError({
                operation: 'placeBlock',
                reason: 'Cannot place block inside player',
              }))
            }

            yield* setBlockInChunk(chunk, lx, y, lz, blockType).pipe(
              /* c8 ignore next 4 */
              Effect.mapError((e: BlockIndexError) => new BlockServiceError({
                operation: 'placeBlock',
                reason: `Block coordinates out of bounds: (${e.x}, ${e.y}, ${e.z})`,
                cause: e,
              }))
            )

            yield* inventoryService.removeBlock(blockType, 1, preferredInventorySlot).pipe(
              Effect.catchTag('InventoryError', () =>
                setBlockInChunk(chunk, lx, y, lz, 'AIR').pipe(
                  /* c8 ignore next 4 */
                  Effect.mapError((e: BlockIndexError) => new BlockServiceError({
                    operation: 'placeBlock',
                    reason: `Failed to restore block after inventory rollback: (${e.x}, ${e.y}, ${e.z})`,
                    cause: e,
                  })),
                  Effect.andThen(Effect.fail(new BlockServiceError({
                    operation: 'placeBlock',
                    reason: `No ${blockType} available in inventory`,
                  })))
                )
              )
            )

            yield* chunkManagerService.markChunkDirty(chunkCoord, [{ lx, y, lz }])
            yield* fluidService.notifyBlockChanged(position)
            if (blockType === 'WATER') yield* fluidService.seedWater(position)
            if (blockType === 'LAVA') yield* fluidService.seedLava(position)
            yield* Metric.increment(Metric.counter('blocks_placed'))
          }),

        forceSetBlock: (position: Position, blockType: BlockType): Effect.Effect<void, BlockServiceError> =>
          Effect.gen(function* () {
            const { chunkCoord, lx, lz } = worldToBlockLocal(position)
            const y = Math.floor(position.y)
            const chunk = yield* chunkManagerService.getChunk(chunkCoord).pipe(
              Effect.mapError((e) => new BlockServiceError({
                operation: 'forceSetBlock',
                reason: `Failed to load chunk at (${chunkCoord.x}, ${chunkCoord.z}): ${e.message}`,
                cause: e,
              }))
            )
            yield* setBlockInChunk(chunk, lx, y, lz, blockType).pipe(
              Effect.mapError((e: BlockIndexError) => new BlockServiceError({
                operation: 'forceSetBlock',
                reason: `Block coordinates out of bounds: (${e.x}, ${e.y}, ${e.z})`,
                cause: e,
              }))
            )
            yield* chunkManagerService.markChunkDirty(chunkCoord, [{ lx, y, lz }])
          }),
      }))
    )),
  }
) {}
export const BlockServiceLive = BlockService.Default
