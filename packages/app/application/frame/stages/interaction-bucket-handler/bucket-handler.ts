import { Effect, Option } from 'effect'
import { type BlockType, type SlotIndex, type InventoryItem } from '@ts-minecraft/core'
import type { FrameStageRefs } from '@ts-minecraft/app/application/frame/types/stage-refs'
import type { FrameBucketInteractionServices } from '@ts-minecraft/app/frame/frame-interaction-service-types/bucket'
import type { TargetRayHit } from '@ts-minecraft/app/frame/stages/interaction-types'
import { selectedHotbarSlotIndex } from '../selected-hotbar-slot'
import { adjacentToHit } from '../placement-geometry'
import { markChunkDirtyAt, readBlockTypeAt } from '../interaction-block-access'

type BucketItem = Extract<InventoryItem, 'BUCKET' | 'WATER_BUCKET' | 'LAVA_BUCKET'>

export const resolveFilledBucketType = (fluidBlock: Extract<BlockType, 'WATER' | 'LAVA'>): 'WATER_BUCKET' | 'LAVA_BUCKET' =>
  fluidBlock === 'WATER' ? 'WATER_BUCKET' : 'LAVA_BUCKET'

export const resolveBucketFluidBlock = (bucketItem: 'WATER_BUCKET' | 'LAVA_BUCKET'): Extract<BlockType, 'WATER' | 'LAVA'> =>
  bucketItem === 'WATER_BUCKET' ? 'WATER' : 'LAVA'

const isBucketItem = (item: InventoryItem): item is BucketItem =>
  item === 'BUCKET' || item === 'WATER_BUCKET' || item === 'LAVA_BUCKET'

const swapHeldBucketItem = (
  services: FrameBucketInteractionServices,
  slot: SlotIndex,
  from: InventoryItem,
  to: InventoryItem,
): Effect.Effect<void> =>
  services.inventoryService.removeBlock(from, 1, slot).pipe(
    Effect.catchAll(() => Effect.void),
    Effect.flatMap(() => services.inventoryService.addBlock(to, 1).pipe(Effect.catchAll(() => Effect.void))),
  )

const fillBucketFromFluidSource = (
  services: FrameBucketInteractionServices,
  refs: Pick<FrameStageRefs, 'dirtyChunksRef'>,
  slot: SlotIndex,
  targetPos: { readonly x: number; readonly y: number; readonly z: number },
  fluidBlock: Extract<BlockType, 'WATER' | 'LAVA'>,
): Effect.Effect<boolean> =>
  (fluidBlock === 'WATER' ? services.fluidService.removeWater(targetPos) : services.fluidService.removeLava(targetPos)).pipe(
    Effect.flatMap(() => services.fluidService.notifyBlockChanged(targetPos)),
    Effect.flatMap(() => swapHeldBucketItem(services, slot, 'BUCKET', resolveFilledBucketType(fluidBlock))),
    Effect.flatMap(() => markChunkDirtyAt(services.chunkManagerService, refs.dirtyChunksRef, targetPos)),
    Effect.flatMap(() => services.soundManager.playEffect('blockBreak', { position: targetPos })),
    Effect.as(true),
  )

const fillCauldronFromWaterBucket = (
  services: FrameBucketInteractionServices,
  refs: Pick<FrameStageRefs, 'dirtyChunksRef'>,
  slot: SlotIndex,
  targetPos: { readonly x: number; readonly y: number; readonly z: number },
): Effect.Effect<boolean> =>
  services.blockService.forceSetBlock(targetPos, 'WATER_CAULDRON').pipe(
    Effect.catchAll(() => Effect.void),
    Effect.flatMap(() => swapHeldBucketItem(services, slot, 'WATER_BUCKET', 'BUCKET')),
    Effect.flatMap(() => markChunkDirtyAt(services.chunkManagerService, refs.dirtyChunksRef, targetPos)),
    Effect.flatMap(() => services.soundManager.playEffect('blockPlace', { position: targetPos })),
    Effect.as(true),
  )

const emptyWaterCauldronIntoBucket = (
  services: FrameBucketInteractionServices,
  refs: Pick<FrameStageRefs, 'dirtyChunksRef'>,
  slot: SlotIndex,
  targetPos: { readonly x: number; readonly y: number; readonly z: number },
): Effect.Effect<boolean> =>
  services.blockService.forceSetBlock(targetPos, 'CAULDRON').pipe(
    Effect.catchAll(() => Effect.void),
    Effect.flatMap(() => swapHeldBucketItem(services, slot, 'BUCKET', 'WATER_BUCKET')),
    Effect.flatMap(() => markChunkDirtyAt(services.chunkManagerService, refs.dirtyChunksRef, targetPos)),
    Effect.flatMap(() => services.soundManager.playEffect('blockBreak', { position: targetPos })),
    Effect.as(true),
  )

const emptyBucketIntoWorld = (
  services: FrameBucketInteractionServices,
  refs: Pick<FrameStageRefs, 'dirtyChunksRef'>,
  slot: SlotIndex,
  hit: TargetRayHit,
  bucketItem: 'WATER_BUCKET' | 'LAVA_BUCKET',
): Effect.Effect<boolean> =>
  {
    const fluidBlock = resolveBucketFluidBlock(bucketItem)
    const placePos = adjacentToHit(hit)
    return services.blockService.forceSetBlock(placePos, fluidBlock).pipe(
      Effect.catchAll(() => Effect.void),
      Effect.flatMap(() => (fluidBlock === 'WATER' ? services.fluidService.seedWater(placePos) : services.fluidService.seedLava(placePos))),
      Effect.flatMap(() => services.fluidService.notifyBlockChanged(placePos)),
      Effect.flatMap(() => swapHeldBucketItem(services, slot, bucketItem, 'BUCKET')),
      Effect.flatMap(() => markChunkDirtyAt(services.chunkManagerService, refs.dirtyChunksRef, placePos)),
      Effect.flatMap(() => services.soundManager.playEffect('blockPlace', { position: placePos })),
      Effect.as(true),
    )
  }

export const handleBucket = (
  services: FrameBucketInteractionServices,
  refs: Pick<FrameStageRefs, 'dirtyChunksRef'>,
  context: { readonly targetHit: Option.Option<TargetRayHit> },
): Effect.Effect<boolean> =>
  Effect.gen(function* () {
    const hit = Option.getOrNull(context.targetHit)
    if (hit === null) return false
    const selected = yield* services.hotbarService.getSelectedBlockType()
    const item = Option.getOrNull(selected)
    if (item === null || !isBucketItem(item)) return false
    const selectedSlot = yield* services.hotbarService.getSelectedSlot()
    const slot: SlotIndex = selectedHotbarSlotIndex(selectedSlot)
    const targetPos = { x: hit.blockX, y: hit.blockY, z: hit.blockZ }
    const blockType = yield* readBlockTypeAt(services.chunkManagerService, targetPos).pipe(
      Effect.catchAll(() => Effect.succeed(null)),
    )

    if (item === 'BUCKET') {
      if (blockType === 'WATER_CAULDRON') return yield* emptyWaterCauldronIntoBucket(services, refs, slot, targetPos)
      if (blockType !== 'WATER' && blockType !== 'LAVA') return false
      return yield* fillBucketFromFluidSource(services, refs, slot, targetPos, blockType)
    }

    if (item === 'WATER_BUCKET') {
      if (blockType === 'CAULDRON') return yield* fillCauldronFromWaterBucket(services, refs, slot, targetPos)
      if (blockType === 'WATER_CAULDRON') return true
    }

    if (blockType === 'WATER_CAULDRON') return true

    return yield* emptyBucketIntoWorld(services, refs, slot, hit, item)
  })
