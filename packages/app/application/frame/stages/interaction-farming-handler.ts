import { Effect, HashMap, HashSet, MutableRef, Option, Schema } from 'effect'
import { CHUNK_SIZE, CHUNK_HEIGHT, decodeBlockType, SlotIndex, ItemTypeSchema } from '@ts-minecraft/core'
import type { BlockType, InventoryItem, Position } from '@ts-minecraft/core'
import { HOTBAR_START } from '@ts-minecraft/inventory/application/inventory-service'
import type { FrameHandlerServices } from '@ts-minecraft/app/application/frame/types/services'
import type { FrameStageRefs } from '@ts-minecraft/app/application/frame/types/stage-refs'
import type { TargetRayHit } from '@ts-minecraft/app/frame/stages/interaction-types'
import { HOE_ITEM_TYPES, TILLABLE_BLOCK_TYPES } from '@ts-minecraft/world'
import {
  SAPLING_TREE_TRUNK_HEIGHT,
  SAPLING_REPLACEABLE_BLOCK_TYPES,
  CROP_SOIL_BLOCK_TYPES,
  PLANTABLE_CROP_ITEMS,
  BONE_MEAL_CROP_BLOCK_TYPES,
} from './interaction-farming-handler.config'

type ChunkCoord = { readonly x: number; readonly z: number }
type SaplingTreeBlock = { readonly position: Position; readonly blockType: 'WOOD' | 'LEAVES' }

type FarmingServices = Pick<
  FrameHandlerServices,
  'hotbarService' | 'blockService' | 'chunkManagerService' | 'soundManager' | 'inventoryService' | 'cropGrowthService'
>
type FarmingRefs = Pick<FrameStageRefs, 'dirtyChunksRef'>

const chunkCoordFor = (position: Position): ChunkCoord => ({
  x: Math.floor(position.x / CHUNK_SIZE),
  z: Math.floor(position.z / CHUNK_SIZE),
})

const chunkCoordKey = (coord: ChunkCoord): string => `${coord.x},${coord.z}`

const localCoordFromWorld = (coord: number): number => ((coord % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE

const localBlockIndexFor = (position: Position): number =>
  position.y
  + localCoordFromWorld(position.z) * CHUNK_HEIGHT
  + localCoordFromWorld(position.x) * CHUNK_HEIGHT * CHUNK_SIZE

const blockTypeAt = (blocks: ArrayLike<number>, position: Position): Option.Option<BlockType> => {
  if (position.y < 0 || position.y >= CHUNK_HEIGHT) return Option.none()
  const blockId = blocks[localBlockIndexFor(position)]
  return decodeBlockType(blockId)
}

const markChunkDirty = (
  services: Pick<FarmingServices, 'chunkManagerService'>,
  refs: FarmingRefs,
  coord: ChunkCoord,
) =>
  services.chunkManagerService.getChunk(coord).pipe(
    Effect.map((updated) => {
      MutableRef.set(
        refs.dirtyChunksRef,
        HashMap.set(MutableRef.get(refs.dirtyChunksRef), chunkCoordKey(coord), {
          chunk: updated,
          dirtyAABB: Option.none(),
        }),
      )
    }),
  )

export const planSaplingTreeBlocks = (base: Position): ReadonlyArray<SaplingTreeBlock> => {
  const blocks: Array<SaplingTreeBlock> = []
  for (let yOffset = 3; yOffset <= 5; yOffset++) {
    const radius = yOffset === 5 ? 1 : 2
    for (let dx = -radius; dx <= radius; dx++) {
      for (let dz = -radius; dz <= radius; dz++) {
        const isCorner = radius === 2 && Math.abs(dx) === 2 && Math.abs(dz) === 2
        const isTrunkColumn = dx === 0 && dz === 0 && yOffset < SAPLING_TREE_TRUNK_HEIGHT
        if (isCorner || isTrunkColumn) continue
        blocks.push({ position: { x: base.x + dx, y: base.y + yOffset, z: base.z + dz }, blockType: 'LEAVES' })
      }
    }
  }
  for (let yOffset = 0; yOffset < SAPLING_TREE_TRUNK_HEIGHT; yOffset++) {
    blocks.push({ position: { x: base.x, y: base.y + yOffset, z: base.z }, blockType: 'WOOD' })
  }
  return blocks
}

const canSaplingTreeOccupy = (
  services: Pick<FarmingServices, 'chunkManagerService'>,
  plannedBlocks: ReadonlyArray<SaplingTreeBlock>,
): Effect.Effect<boolean, never> =>
  Effect.gen(function* () {
    for (const { position } of plannedBlocks) {
      if (position.y < 0 || position.y >= CHUNK_HEIGHT) return false
      const chunk = yield* services.chunkManagerService
        .getChunk(chunkCoordFor(position))
        .pipe(Effect.catchAll(() => Effect.succeed(null)))
      if (chunk === null) return false
      const blockType = Option.getOrNull(blockTypeAt(chunk.blocks, position))
      if (blockType === null || !SAPLING_REPLACEABLE_BLOCK_TYPES.has(blockType)) return false
    }
    return true
  })

const markSaplingTreeChunksDirty = (
  services: Pick<FarmingServices, 'chunkManagerService'>,
  refs: FarmingRefs,
  plannedBlocks: ReadonlyArray<SaplingTreeBlock>,
) =>
  Effect.gen(function* () {
    const touchedCoords = new Map<string, ChunkCoord>()
    for (const { position } of plannedBlocks) {
      const coord = chunkCoordFor(position)
      touchedCoords.set(chunkCoordKey(coord), coord)
    }
    for (const [, coord] of touchedCoords) {
      yield* markChunkDirty(services, refs, coord)
    }
  })

const tillBlock = (
  services: FarmingServices,
  refs: FarmingRefs,
  targetPos: Position,
  targetChunkCoord: ChunkCoord,
): Effect.Effect<boolean, never> =>
  Effect.gen(function* () {
    yield* services.blockService.forceSetBlock(targetPos, 'FARMLAND')
    yield* markChunkDirty(services, refs, targetChunkCoord)
    yield* services.soundManager.playEffect('blockPlace', { position: targetPos })
    return true
  }).pipe(Effect.catchAll(() => Effect.succeed(false)))

const applyBoneMealToCrop = (
  services: FarmingServices,
  selectedSlot: number,
  targetPos: Position,
): Effect.Effect<boolean, never> =>
  Effect.gen(function* () {
    yield* services.inventoryService.removeBlock('BONE_MEAL', 1, SlotIndex.make(HOTBAR_START + selectedSlot))
    yield* services.cropGrowthService.advanceByBoneMeal(targetPos)
    yield* services.soundManager.playEffect('blockPlace', { position: targetPos })
    return true
  }).pipe(Effect.catchAll(() => Effect.succeed(false)))

const growSaplingWithBoneMeal = (
  services: FarmingServices,
  refs: FarmingRefs,
  selectedSlot: number,
  targetPos: Position,
): Effect.Effect<boolean, never> =>
  Effect.gen(function* () {
    const plannedBlocks = planSaplingTreeBlocks(targetPos)
    const canGrow = yield* canSaplingTreeOccupy(services, plannedBlocks)
    if (!canGrow) return false
    yield* services.inventoryService.removeBlock('BONE_MEAL', 1, SlotIndex.make(HOTBAR_START + selectedSlot))
    for (const planned of plannedBlocks) {
      yield* services.blockService.forceSetBlock(planned.position, planned.blockType)
    }
    yield* markSaplingTreeChunksDirty(services, refs, plannedBlocks)
    yield* services.soundManager.playEffect('blockPlace', { position: targetPos })
    return true
  }).pipe(Effect.catchAll(() => Effect.succeed(false)))

const plantCrop = (
  services: FarmingServices,
  refs: FarmingRefs,
  selectedSlot: number,
  cropItem: InventoryItem,
  cropBlockType: BlockType,
  cropPos: Position,
): Effect.Effect<boolean, never> =>
  Effect.gen(function* () {
    yield* services.inventoryService.removeBlock(cropItem, 1, SlotIndex.make(HOTBAR_START + selectedSlot))
    yield* services.blockService.forceSetBlock(cropPos, cropBlockType)
    yield* services.cropGrowthService.plant(cropPos)
    yield* markChunkDirty(services, refs, chunkCoordFor(cropPos))
    yield* services.soundManager.playEffect('blockPlace', { position: cropPos })
    return true
  }).pipe(Effect.catchAll(() => Effect.succeed(false)))

/**
 * Handles farming interactions: hoe-tilling (DIRT/GRASS → FARMLAND) and crop
 * planting (plantable item on FARMLAND → crop above). Returns true when an
 * interaction was consumed so the caller can skip normal block placement.
 */
export const handleFarmingInteraction = (
  services: FarmingServices,
  refs: FarmingRefs,
  context: { readonly targetHit: Option.Option<TargetRayHit> },
): Effect.Effect<boolean, never> =>
  Effect.gen(function* () {
    const hit = Option.getOrNull(context.targetHit)
    if (hit === null) return false
    const selected = yield* services.hotbarService.getSelectedBlockType()
    const item = Option.getOrNull(selected)
    if (item === null || !Schema.is(ItemTypeSchema)(item)) return false
    const selectedSlot = yield* services.hotbarService.getSelectedSlot()

    const targetChunkCoord = chunkCoordFor({ x: hit.blockX, y: hit.blockY, z: hit.blockZ })
    const targetPos = { x: hit.blockX, y: hit.blockY, z: hit.blockZ }

    if (HashSet.has(HOE_ITEM_TYPES, item)) {
      const chunk = yield* services.chunkManagerService
        .getChunk(targetChunkCoord)
        .pipe(Effect.catchAll(() => Effect.succeed(null)))
      if (chunk === null) return false
      const blockType = Option.getOrNull(blockTypeAt(chunk.blocks, targetPos))
      if (blockType === null || !HashSet.has(TILLABLE_BLOCK_TYPES, blockType)) return false
      return yield* tillBlock(services, refs, targetPos, targetChunkCoord)
    }

    if (item === 'BONE_MEAL') {
      const chunk = yield* services.chunkManagerService
        .getChunk(targetChunkCoord)
        .pipe(Effect.catchAll(() => Effect.succeed(null)))
      if (chunk === null) return false
      const blockType = Option.getOrNull(blockTypeAt(chunk.blocks, targetPos))
      if (blockType === null) return false
      if (BONE_MEAL_CROP_BLOCK_TYPES.has(blockType)) {
        return yield* applyBoneMealToCrop(services, selectedSlot, targetPos)
      }
      if (blockType === 'SAPLING') {
        return yield* growSaplingWithBoneMeal(services, refs, selectedSlot, targetPos)
      }
      return false
    }

    const cropBlockType = PLANTABLE_CROP_ITEMS.get(item)
    if (cropBlockType !== undefined) {
      const chunk = yield* services.chunkManagerService
        .getChunk(targetChunkCoord)
        .pipe(Effect.catchAll(() => Effect.succeed(null)))
      if (chunk === null) return false
      const blockType = Option.getOrNull(blockTypeAt(chunk.blocks, targetPos))
      const requiredSoil = CROP_SOIL_BLOCK_TYPES.get(cropBlockType) ?? 'FARMLAND'
      if (blockType === null || blockType !== requiredSoil) return false
      const cropPos = { x: hit.blockX, y: hit.blockY + 1, z: hit.blockZ }
      return yield* plantCrop(services, refs, selectedSlot, item, cropBlockType, cropPos)
    }

    return false
  })
