import { Effect, HashMap, HashSet, MutableRef, Option, Schema } from 'effect'
import { CHUNK_SIZE, CHUNK_HEIGHT, decodeBlockType, SlotIndex, ItemTypeSchema } from '@ts-minecraft/core'
import type { BlockType, Position } from '@ts-minecraft/core'
import { HOTBAR_START } from '@ts-minecraft/inventory/application/inventory-service'
import type { FrameHandlerServices } from '@ts-minecraft/app/application/frame/types/services'
import type { FrameStageRefs } from '@ts-minecraft/app/application/frame/types/stage-refs'
import type { TargetRayHit } from '@ts-minecraft/app/frame/stages/interaction-types'
import { HOE_ITEM_TYPES, TILLABLE_BLOCK_TYPES } from '@ts-minecraft/world'

type ChunkCoord = { readonly x: number; readonly z: number }
type SaplingTreeBlock = { readonly position: Position; readonly blockType: 'WOOD' | 'LEAVES' }

const SAPLING_TREE_TRUNK_HEIGHT = 5
const SAPLING_REPLACEABLE_BLOCK_TYPES = new Set<BlockType>(['AIR', 'LEAVES', 'SAPLING'])

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

export const planSaplingTreeBlocks = (base: Position): ReadonlyArray<SaplingTreeBlock> => {
  const blocks: Array<SaplingTreeBlock> = []
  for (let yOffset = 3; yOffset <= 5; yOffset++) {
    const radius = yOffset === 5 ? 1 : 2
    for (let dx = -radius; dx <= radius; dx++) {
      for (let dz = -radius; dz <= radius; dz++) {
        const isCorner = radius === 2 && Math.abs(dx) === 2 && Math.abs(dz) === 2
        const isTrunkColumn = dx === 0 && dz === 0 && yOffset < SAPLING_TREE_TRUNK_HEIGHT
        if (isCorner || isTrunkColumn) continue
        blocks.push({
          position: { x: base.x + dx, y: base.y + yOffset, z: base.z + dz },
          blockType: 'LEAVES',
        })
      }
    }
  }

  for (let yOffset = 0; yOffset < SAPLING_TREE_TRUNK_HEIGHT; yOffset++) {
    blocks.push({
      position: { x: base.x, y: base.y + yOffset, z: base.z },
      blockType: 'WOOD',
    })
  }
  return blocks
}

const canSaplingTreeOccupy = (
  services: Pick<FrameHandlerServices, 'chunkManagerService'>,
  plannedBlocks: ReadonlyArray<SaplingTreeBlock>,
) =>
  Effect.gen(function* () {
    for (const { position } of plannedBlocks) {
      if (position.y < 0 || position.y >= CHUNK_HEIGHT) return false
      const chunk = yield* services.chunkManagerService
        .getChunk(chunkCoordFor(position))
        .pipe(Effect.catchAll(() => Effect.succeed(null)))
      if (chunk === null) return false
      const blockType = Option.getOrNull(blockTypeAt(chunk.blocks, position))
      if (blockType === null) return false
      if (!SAPLING_REPLACEABLE_BLOCK_TYPES.has(blockType)) return false
    }
    return true
  })

const markSaplingTreeChunksDirty = (
  services: Pick<FrameHandlerServices, 'chunkManagerService'>,
  refs: Pick<FrameStageRefs, 'dirtyChunksRef'>,
  plannedBlocks: ReadonlyArray<SaplingTreeBlock>,
) =>
  Effect.gen(function* () {
    const touchedCoords = new Map<string, ChunkCoord>()
    for (const { position } of plannedBlocks) {
      const coord = chunkCoordFor(position)
      touchedCoords.set(chunkCoordKey(coord), coord)
    }
    for (const [key, coord] of touchedCoords) {
      const updated = yield* services.chunkManagerService.getChunk(coord)
      MutableRef.set(
        refs.dirtyChunksRef,
        HashMap.set(MutableRef.get(refs.dirtyChunksRef), key, { chunk: updated, dirtyAABB: Option.none() }),
      )
    }
  })

/**
 * Handles farming interactions: hoe-tilling (DIRT/GRASS → FARMLAND) and seed
 * planting (WHEAT_SEEDS on FARMLAND → WHEAT_CROP above). Returns true when an
 * interaction was consumed so the caller can skip normal block placement.
 */
export const handleFarmingInteraction = (
  services: Pick<
    FrameHandlerServices,
    'hotbarService' | 'blockService' | 'chunkManagerService' | 'soundManager' | 'inventoryService' | 'cropGrowthService'
  >,
  refs: Pick<FrameStageRefs, 'dirtyChunksRef'>,
  context: { readonly targetHit: Option.Option<TargetRayHit> },
): Effect.Effect<boolean, never> =>
  Effect.gen(function* () {
    const hit = Option.getOrNull(context.targetHit)
    if (hit === null) return false
    const selected = yield* services.hotbarService.getSelectedBlockType()
    const item = Option.getOrNull(selected)
    if (item === null || !Schema.is(ItemTypeSchema)(item)) return false
    const selectedSlot = yield* services.hotbarService.getSelectedSlot()

    const targetChunkCoord = {
      x: Math.floor(hit.blockX / CHUNK_SIZE),
      z: Math.floor(hit.blockZ / CHUNK_SIZE),
    }
    const coordKey = `${targetChunkCoord.x},${targetChunkCoord.z}`

    if (HashSet.has(HOE_ITEM_TYPES, item)) {
      const chunk = yield* services.chunkManagerService
        .getChunk(targetChunkCoord)
        .pipe(Effect.catchAll(() => Effect.succeed(null)))
      if (chunk === null) return false
      const targetPos = { x: hit.blockX, y: hit.blockY, z: hit.blockZ }
      const blockType = Option.getOrNull(blockTypeAt(chunk.blocks, targetPos))
      if (blockType === null) return false
      if (!HashSet.has(TILLABLE_BLOCK_TYPES, blockType)) return false
      return yield* Effect.gen(function* () {
        yield* services.blockService.forceSetBlock(targetPos, 'FARMLAND')
        const updated = yield* services.chunkManagerService.getChunk(targetChunkCoord)
        MutableRef.set(
          refs.dirtyChunksRef,
          HashMap.set(MutableRef.get(refs.dirtyChunksRef), coordKey, { chunk: updated, dirtyAABB: Option.none() }),
        )
        yield* services.soundManager.playEffect('blockPlace', { position: targetPos })
        return true
      }).pipe(Effect.catchAll(() => Effect.succeed(false)))
    }

    if (item === 'BONE_MEAL') {
      const chunk = yield* services.chunkManagerService
        .getChunk(targetChunkCoord)
        .pipe(Effect.catchAll(() => Effect.succeed(null)))
      if (chunk === null) return false
      const targetPos = { x: hit.blockX, y: hit.blockY, z: hit.blockZ }
      const blockType = Option.getOrNull(blockTypeAt(chunk.blocks, targetPos))
      if (blockType === null) return false
      if (blockType === 'WHEAT_CROP') {
        return yield* Effect.gen(function* () {
          yield* services.inventoryService.removeBlock('BONE_MEAL', 1, SlotIndex.make(HOTBAR_START + selectedSlot))
          yield* services.cropGrowthService.advanceByBoneMeal(targetPos)
          yield* services.soundManager.playEffect('blockPlace', { position: targetPos })
          return true
        }).pipe(Effect.catchAll(() => Effect.succeed(false)))
      }

      if (blockType !== 'SAPLING') return false
      const plannedBlocks = planSaplingTreeBlocks(targetPos)
      return yield* Effect.gen(function* () {
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
    }

    if (item === 'WHEAT_SEEDS') {
      const chunk = yield* services.chunkManagerService
        .getChunk(targetChunkCoord)
        .pipe(Effect.catchAll(() => Effect.succeed(null)))
      if (chunk === null) return false
      const blockType = Option.getOrNull(blockTypeAt(chunk.blocks, { x: hit.blockX, y: hit.blockY, z: hit.blockZ }))
      if (blockType === null) return false
      if (blockType !== 'FARMLAND') return false
      const cropPos = { x: hit.blockX, y: hit.blockY + 1, z: hit.blockZ }
      const cropCoord = {
        x: Math.floor(cropPos.x / CHUNK_SIZE),
        z: Math.floor(cropPos.z / CHUNK_SIZE),
      }
      const cropCoordKey = `${cropCoord.x},${cropCoord.z}`
      return yield* Effect.gen(function* () {
        yield* services.inventoryService.removeBlock('WHEAT_SEEDS', 1, SlotIndex.make(HOTBAR_START + selectedSlot))
        yield* services.blockService.forceSetBlock(cropPos, 'WHEAT_CROP')
        // Register in growth tracker (age 0 = seedling)
        yield* services.cropGrowthService.plant(cropPos)
        const updated = yield* services.chunkManagerService.getChunk(cropCoord)
        MutableRef.set(
          refs.dirtyChunksRef,
          HashMap.set(MutableRef.get(refs.dirtyChunksRef), cropCoordKey, { chunk: updated, dirtyAABB: Option.none() }),
        )
        yield* services.soundManager.playEffect('blockPlace', { position: cropPos })
        return true
      }).pipe(Effect.catchAll(() => Effect.succeed(false)))
    }

    return false
  })
