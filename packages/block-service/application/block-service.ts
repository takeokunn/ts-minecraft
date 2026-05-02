import { Effect, Data, HashSet, Metric, Option } from 'effect'
import { ChunkManagerService } from '@ts-minecraft/chunk-manager'
import { DEFAULT_PLAYER_ID } from '@ts-minecraft/kernel'
import { FluidService } from '@ts-minecraft/fluid-simulation'
import { ChunkService, CHUNK_SIZE, setBlockInChunk, BlockIndexError } from '@ts-minecraft/domain'
import type { ChunkCoord } from '@ts-minecraft/domain'
import { PlayerService } from '@ts-minecraft/player-controller'
import { InventoryService } from '@ts-minecraft/inventory-system'
import { HotbarService } from '@ts-minecraft/hotbar-system'
import { FurnaceService } from '@ts-minecraft/furnace-system'
import { BlockType } from '@ts-minecraft/domain'
import { Position, SlotIndex } from '@ts-minecraft/kernel'
import {
  NON_PLACEABLE_BLOCK_TYPES,
  PICKAXE_BLOCK_TYPES,
  DIAMOND_PICKAXE_HARVESTABLE_BLOCKS,
  IRON_PICKAXE_HARVESTABLE_BLOCKS,
  STONE_PICKAXE_HARVESTABLE_BLOCKS,
  WOODEN_PICKAXE_HARVESTABLE_BLOCKS,
  getInventoryDropForBlock,
} from './block-service.config'

const REQUIRES_PICKAXE_BLOCKS = DIAMOND_PICKAXE_HARVESTABLE_BLOCKS

// ─── Player AABB dimensions ────────────────────────────────────────────────────
// Must match the Cannon-ES body half-extents in physics-service.ts.

export const PLAYER_HALF_WIDTH = 0.3   // x and z half-extents
export const PLAYER_HALF_HEIGHT = 0.9  // y half-extent

const canHarvestBlock = (blockType: BlockType, selectedTool: Option.Option<BlockType>): boolean =>
  Option.match(selectedTool, {
    onNone: () => !HashSet.has(IRON_PICKAXE_HARVESTABLE_BLOCKS, blockType),
    onSome: (tool) => {
      if (tool === 'DIAMOND_PICKAXE') return HashSet.has(DIAMOND_PICKAXE_HARVESTABLE_BLOCKS, blockType)
      if (tool === 'IRON_PICKAXE') return HashSet.has(IRON_PICKAXE_HARVESTABLE_BLOCKS, blockType)
      if (tool === 'STONE_PICKAXE') return HashSet.has(STONE_PICKAXE_HARVESTABLE_BLOCKS, blockType)
      if (tool === 'WOODEN_PICKAXE') return HashSet.has(WOODEN_PICKAXE_HARVESTABLE_BLOCKS, blockType)
      return !HashSet.has(IRON_PICKAXE_HARVESTABLE_BLOCKS, blockType)
    },
  })

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

// ─── Pure data/logic helpers ──────────────────────────────────────────────────

// Double-modulo handles negative coordinates correctly.
export const worldToBlockLocal = (
  pos: Position
): { chunkCoord: ChunkCoord; lx: number; lz: number } => {
  const cx = Math.floor(pos.x / CHUNK_SIZE)
  const cz = Math.floor(pos.z / CHUNK_SIZE)
  const lx = ((Math.floor(pos.x) % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE
  const lz = ((Math.floor(pos.z) % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE
  return { chunkCoord: { x: cx, z: cz }, lx, lz }
}

// Player AABB centered at (feet.x, feet.y+HALF_HEIGHT, feet.z); block is unit cube centered at (pos+0.5).
export const blockOverlapsPlayer = (blockPos: Position, playerFeetPos: Position): boolean => {
  const playerCenterY = playerFeetPos.y + PLAYER_HALF_HEIGHT
  const blockHalf = 0.5
  return (
    Math.abs(blockPos.x + blockHalf - playerFeetPos.x) < blockHalf + PLAYER_HALF_WIDTH &&
    Math.abs(blockPos.y + blockHalf - playerCenterY) < blockHalf + PLAYER_HALF_HEIGHT &&
    Math.abs(blockPos.z + blockHalf - playerFeetPos.z) < blockHalf + PLAYER_HALF_WIDTH
  )
}

// ─── Service ─────────────────────────────────────────────────────────────────

export class BlockService extends Effect.Service<BlockService>()(
  '@minecraft/application/BlockService',
  {
    effect: Effect.all([
      ChunkManagerService,
      ChunkService,
      FluidService,
      PlayerService,
      InventoryService,
      HotbarService,
      FurnaceService,
    ], { concurrency: 'unbounded' }).pipe(
      Effect.map(([chunkManagerService, chunkService, fluidService, playerService, inventoryService, hotbarService, furnaceService]) => ({

        breakBlock: (position: Position): Effect.Effect<void, BlockServiceError> =>
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
            const shouldDrop = HashSet.has(PICKAXE_BLOCK_TYPES, Option.getOrElse(selectedTool, () => 'AIR'))
              ? canHarvestBlock(blockType, selectedTool)
              : canHarvestBlock(blockType, Option.none())
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
              Effect.mapError((e: BlockIndexError) => new BlockServiceError({
                operation: 'breakBlock',
                reason: `Block coordinates out of bounds: (${e.x}, ${e.y}, ${e.z})`,
                cause: e,
              }))
            )

            yield* chunkManagerService.markChunkDirty(chunkCoord)
            if (blockType === 'WATER') yield* fluidService.removeWater(position)
            yield* fluidService.notifyBlockChanged(position)
            yield* Metric.counter('blocks_broken').pipe(Metric.increment)
            if (shouldDrop) {
              yield* inventoryService.addBlock(getInventoryDropForBlock(blockType), 1).pipe(Effect.catchAllCause(() => Effect.void))
            }
          }),

        placeBlock: (position: Position, blockType: BlockType, preferredInventorySlot?: SlotIndex): Effect.Effect<void, BlockServiceError> =>
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

            if (HashSet.has(NON_PLACEABLE_BLOCK_TYPES, blockType)) {
              return yield* Effect.fail(new BlockServiceError({
                operation: 'placeBlock',
                reason: `${blockType} is an inventory item and cannot be placed in the world`,
              }))
            }

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
              Effect.mapError((e: BlockIndexError) => new BlockServiceError({
                operation: 'placeBlock',
                reason: `Block coordinates out of bounds: (${e.x}, ${e.y}, ${e.z})`,
                cause: e,
              }))
            )

            const removedFromInventory = yield* inventoryService.removeBlock(blockType, 1, preferredInventorySlot)
            if (!removedFromInventory) {
              yield* setBlockInChunk(chunk, lx, y, lz, 'AIR').pipe(
                Effect.mapError((e: BlockIndexError) => new BlockServiceError({
                  operation: 'placeBlock',
                  reason: `Failed to restore block after inventory rollback: (${e.x}, ${e.y}, ${e.z})`,
                  cause: e,
                }))
              )
              return yield* Effect.fail(new BlockServiceError({
                operation: 'placeBlock',
                reason: `No ${blockType} available in inventory`,
              }))
            }

            yield* chunkManagerService.markChunkDirty(chunkCoord)
            yield* fluidService.notifyBlockChanged(position)
            if (blockType === 'WATER') yield* fluidService.seedWater(position)
            yield* Metric.counter('blocks_placed').pipe(Metric.increment)
          }),
      }))
    ),
  }
) {}
export const BlockServiceLive = BlockService.Default
