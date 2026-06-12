import { Effect, HashMap, HashSet, Option, Ref, Schema } from 'effect'
import { CHUNK_SIZE, CHUNK_HEIGHT, indexToBlockType, SlotIndex, ItemTypeSchema } from '@ts-minecraft/core'
import { HOTBAR_START } from '@ts-minecraft/inventory'
import type { FrameHandlerServices, FrameStageRefs } from '@ts-minecraft/app/frame/types'
import type { TargetRayHit } from '@ts-minecraft/app/frame/stages/interaction-types'
import { HOE_ITEM_TYPES, TILLABLE_BLOCK_TYPES } from '@ts-minecraft/world'

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
    const selectedSlot = yield* services.hotbarService.getSelectedSlot()
    const item = Option.getOrNull(selected)
    if (item === null || !Schema.is(ItemTypeSchema)(item)) return false

    const targetChunkCoord = {
      x: Math.floor(hit.blockX / CHUNK_SIZE),
      z: Math.floor(hit.blockZ / CHUNK_SIZE),
    }
    const coordKey = `${targetChunkCoord.x},${targetChunkCoord.z}`
    const lx = ((hit.blockX % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE
    const lz = ((hit.blockZ % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE

    if (HashSet.has(HOE_ITEM_TYPES, item)) {
      const chunk = Option.getOrNull(yield* services.chunkManagerService.getChunk(targetChunkCoord).pipe(Effect.option))
      if (chunk === null) return false
      const idx = hit.blockY + lz * CHUNK_HEIGHT + lx * CHUNK_HEIGHT * CHUNK_SIZE
      /* c8 ignore next -- TypedArray never returns undefined for in-bounds idx */
      const blockType = indexToBlockType(chunk.blocks[idx] ?? 0)
      if (!HashSet.has(TILLABLE_BLOCK_TYPES, blockType)) return false
      const targetPos = { x: hit.blockX, y: hit.blockY, z: hit.blockZ }
      return yield* Effect.gen(function* () {
        yield* services.blockService.forceSetBlock(targetPos, 'FARMLAND')
        const updated = yield* services.chunkManagerService.getChunk(targetChunkCoord)
        yield* Ref.update(refs.dirtyChunksRef, (map) =>
          HashMap.set(map, coordKey, { chunk: updated, dirtyAABB: Option.none() }),
        )
        yield* services.soundManager.playEffect('blockPlace', { position: targetPos })
        return true
      }).pipe(Effect.catchAll(() => Effect.succeed(false)))
    }

    if (item === 'BONE_MEAL') {
      const chunk = Option.getOrNull(yield* services.chunkManagerService.getChunk(targetChunkCoord).pipe(Effect.option))
      if (chunk === null) return false
      const idx = hit.blockY + lz * CHUNK_HEIGHT + lx * CHUNK_HEIGHT * CHUNK_SIZE
      /* c8 ignore next -- TypedArray never returns undefined for in-bounds idx */
      const blockType = indexToBlockType(chunk.blocks[idx] ?? 0)
      if (blockType !== 'WHEAT_CROP') return false
      const targetPos = { x: hit.blockX, y: hit.blockY, z: hit.blockZ }
      return yield* Effect.gen(function* () {
        yield* services.inventoryService.removeBlock('BONE_MEAL', 1, SlotIndex.make(HOTBAR_START + selectedSlot))
        yield* services.cropGrowthService.advanceByBoneMeal(targetPos)
        yield* services.soundManager.playEffect('blockPlace', { position: targetPos })
        return true
      }).pipe(Effect.catchAll(() => Effect.succeed(false)))
    }

    if (item === 'WHEAT_SEEDS') {
      const chunk = Option.getOrNull(yield* services.chunkManagerService.getChunk(targetChunkCoord).pipe(Effect.option))
      if (chunk === null) return false
      const idx = hit.blockY + lz * CHUNK_HEIGHT + lx * CHUNK_HEIGHT * CHUNK_SIZE
      /* c8 ignore next -- TypedArray never returns undefined for in-bounds idx */
      const blockType = indexToBlockType(chunk.blocks[idx] ?? 0)
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
        yield* Ref.update(refs.dirtyChunksRef, (map) =>
          HashMap.set(map, cropCoordKey, { chunk: updated, dirtyAABB: Option.none() }),
        )
        yield* services.soundManager.playEffect('blockPlace', { position: cropPos })
        return true
      }).pipe(Effect.catchAll(() => Effect.succeed(false)))
    }

    return false
  })
