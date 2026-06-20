import { Effect, HashSet, Metric, Option } from 'effect'
import { BlockIndexError, CHUNK_HEIGHT, type BlockType, type ChunkCoord, type InventoryItem, type Position } from '@ts-minecraft/core'
import type { Chunk } from '../domain/chunk'
import { setBlockInChunk } from '../domain/chunk'
import { worldPositionFor, type LocalBlock } from '../domain/chunk-coord-utils'
import { InventoryServicePortError } from '../domain/block-service-ports'
import type { ChunkService } from './chunk-service'
import { canHarvestBlock } from '../domain/block-utils'
import { BlockServiceError } from './block-service-error'
import { blockDropsBaseItem, DIAMOND_PICKAXE_HARVESTABLE_BLOCKS, getBlockDropCount, getInventoryDropForBlock, isGrassSeedDropBlock } from './block-service.config'
import { removeUnsupportedCascade } from './block-service-support'

export type BreakBlockOptions = {
  readonly requireHarvest?: boolean
  readonly dropItems?: boolean
}

type ChunkManagerForBreak = {
  readonly getChunk: (coord: ChunkCoord) => Effect.Effect<Chunk, { readonly message: string }>
  readonly markChunkDirty: (coord: ChunkCoord, dirtyVoxels?: ReadonlyArray<LocalBlock>) => Effect.Effect<void, never>
}

type FluidForBreak = {
  readonly removeWater: (position: Position) => Effect.Effect<void, never>
  readonly removeLava: (position: Position) => Effect.Effect<void, never>
  readonly notifyBlockChanged: (position: Position) => Effect.Effect<void, never>
}

type HotbarForBreak = {
  readonly getSelectedBlockType: () => Effect.Effect<Option.Option<InventoryItem>, never>
}

type InventoryForBreak = {
  readonly addBlock: (itemType: InventoryItem, count: number) => Effect.Effect<void, InventoryServicePortError>
}

type ContainerForBreak = {
  readonly dismantleFurnace: (position: Position) => Effect.Effect<boolean, never>
  readonly dismantleChest: (position: Position) => Effect.Effect<boolean, never>
}

export type BreakBlockDeps = {
  readonly chunkManagerService: ChunkManagerForBreak
  readonly chunkService: ChunkService
  readonly fluidService: FluidForBreak
  readonly hotbarService: HotbarForBreak
  readonly inventoryService: InventoryForBreak
  readonly containers: ContainerForBreak
}

type BreakBlockContext = {
  readonly position: Position
  readonly chunkCoord: ChunkCoord
  readonly chunk: Chunk
  readonly lx: number
  readonly y: number
  readonly lz: number
  readonly blockType: BlockType
  readonly silkTouch: boolean
  readonly requireHarvest: boolean
  readonly dropItems: boolean
}

const operation = 'breakBlock'
const REQUIRES_PICKAXE_BLOCKS = DIAMOND_PICKAXE_HARVESTABLE_BLOCKS

export const mapChunkLoadError = (chunkCoord: ChunkCoord) => (e: { readonly message: string }) =>
  new BlockServiceError({
    operation,
    reason: `Failed to load chunk at (${chunkCoord.x}, ${chunkCoord.z}): ${e.message}`,
    cause: e,
  })

export const mapBlockReadError = (lx: number, y: number, lz: number) => (e: { readonly message: string }) =>
  new BlockServiceError({
    operation,
    reason: `Failed to read block at local (${lx}, ${y}, ${lz}): ${e.message}`,
    cause: e,
  })

const mapBlockIndexError = (label: string) => (e: BlockIndexError) =>
  new BlockServiceError({
    operation,
    reason: `${label} coordinates out of bounds: (${e.x}, ${e.y}, ${e.z})`,
    cause: e,
  })

const findDoorPartnerY = (
  chunkService: ChunkService,
  chunk: Chunk,
  lx: number,
  y: number,
  lz: number,
  blockType: BlockType,
): Effect.Effect<number | null, BlockServiceError> =>
  Effect.gen(function* () {
    if (blockType !== 'DOOR' && blockType !== 'DOOR_OPEN') return null
    if (y + 1 < CHUNK_HEIGHT) {
      const above = yield* chunkService.getBlock(chunk, lx, y + 1, lz).pipe(
        Effect.mapError((e) => new BlockServiceError({
          operation,
          reason: `Failed to read upper door block at local (${lx}, ${y + 1}, ${lz}): ${e.message}`,
          cause: e,
        })),
      )
      if (above === blockType) return y + 1
    }
    if (y - 1 >= 0) {
      const below = yield* chunkService.getBlock(chunk, lx, y - 1, lz).pipe(
        Effect.mapError((e) => new BlockServiceError({
          operation,
          reason: `Failed to read lower door block at local (${lx}, ${y - 1}, ${lz}): ${e.message}`,
          cause: e,
        })),
      )
      if (below === blockType) return y - 1
    }
    return null
  })

const dismantleContainer = (
  containers: ContainerForBreak,
  blockType: BlockType,
  position: Position,
): Effect.Effect<void, BlockServiceError> =>
  Effect.gen(function* () {
    if (blockType === 'FURNACE') {
      const dismantled = yield* containers.dismantleFurnace(position)
      if (!dismantled) {
        return yield* Effect.fail(new BlockServiceError({
          operation,
          reason: 'Cannot break furnace while its contents cannot fit in inventory',
        }))
      }
    }

    if (blockType === 'CHEST') {
      const dismantled = yield* containers.dismantleChest(position)
      if (!dismantled) {
        return yield* Effect.fail(new BlockServiceError({
          operation,
          reason: 'Cannot break chest while its contents cannot fit in inventory',
        }))
      }
    }
  })

export const applyBreakBlock = (
  deps: BreakBlockDeps,
  context: BreakBlockContext,
): Effect.Effect<void, BlockServiceError> =>
  Effect.gen(function* () {
    const selectedTool = context.requireHarvest || context.dropItems
      ? yield* deps.hotbarService.getSelectedBlockType()
      : Option.none<InventoryItem>()
    const canHarvest = canHarvestBlock(context.blockType, selectedTool)
    if (context.requireHarvest && HashSet.has(REQUIRES_PICKAXE_BLOCKS, context.blockType) && !canHarvest) {
      return yield* Effect.fail(new BlockServiceError({
        operation,
        reason: `Block requires a stronger pickaxe: ${context.blockType}`,
      }))
    }

    yield* dismantleContainer(deps.containers, context.blockType, context.position)

    const removedBlocks: Array<LocalBlock> = [{ lx: context.lx, y: context.y, lz: context.lz }]
    const doorPartnerY = yield* findDoorPartnerY(deps.chunkService, context.chunk, context.lx, context.y, context.lz, context.blockType)

    yield* setBlockInChunk(context.chunk, context.lx, context.y, context.lz, 'AIR').pipe(
      /* c8 ignore next 4 */
      Effect.mapError(mapBlockIndexError('Block')),
    )
    if (doorPartnerY !== null) {
      yield* setBlockInChunk(context.chunk, context.lx, doorPartnerY, context.lz, 'AIR').pipe(
        /* c8 ignore next 4 */
        Effect.mapError(mapBlockIndexError('Door partner')),
      )
      removedBlocks.push({ lx: context.lx, y: doorPartnerY, lz: context.lz })
    }

    yield* removeUnsupportedCascade(deps.chunkService, context.chunk, removedBlocks, operation)
    yield* deps.chunkManagerService.markChunkDirty(context.chunkCoord, removedBlocks)
    if (context.blockType === 'WATER') yield* deps.fluidService.removeWater(context.position)
    if (context.blockType === 'LAVA') yield* deps.fluidService.removeLava(context.position)
    for (const removedBlock of removedBlocks) {
      yield* deps.fluidService.notifyBlockChanged(worldPositionFor(context.chunkCoord, removedBlock))
    }
    yield* Metric.increment(Metric.counter('blocks_broken'))
    const canDropBaseItem = canHarvest || context.silkTouch
    const shouldDropBaseItem = context.dropItems
      && canDropBaseItem
      && (context.silkTouch || blockDropsBaseItem(context.blockType))
      && (!isGrassSeedDropBlock(context.blockType) || context.silkTouch)
    if (shouldDropBaseItem) {
      const dropItem = context.silkTouch ? context.blockType : getInventoryDropForBlock(context.blockType)
      const dropCount = context.silkTouch ? 1 : getBlockDropCount(context.blockType)
      yield* deps.inventoryService.addBlock(dropItem, dropCount).pipe(Effect.catchAllCause(() => Effect.void))
    }
  })
