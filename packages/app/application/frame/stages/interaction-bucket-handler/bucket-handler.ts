import { Effect, Option } from 'effect'
import { type BlockType, type SlotIndex, type InventoryItem } from '@ts-minecraft/core'
import type { FrameStageRefs } from '@ts-minecraft/app/frame/types'
import type { FrameBucketInteractionServices } from '@ts-minecraft/app/frame/frame-interaction-service-types'
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

const fillBucketFromFluidSource = (
  services: FrameBucketInteractionServices,
  refs: Pick<FrameStageRefs, 'dirtyChunksRef'>,
  slot: SlotIndex,
  targetPos: { readonly x: number; readonly y: number; readonly z: number },
  fluidBlock: Extract<BlockType, 'WATER' | 'LAVA'>,
): Effect.Effect<boolean> =>
  (fluidBlock === 'WATER' ? services.fluidService.removeWater(targetPos) : services.fluidService.removeLava(targetPos)).pipe(
    Effect.flatMap(() => services.fluidService.notifyBlockChanged(targetPos)),
    Effect.flatMap(() => {
      const filledBucket = resolveFilledBucketType(fluidBlock)
      return services.inventoryService.removeBlock('BUCKET', 1, slot).pipe(
        Effect.catchAll(() => Effect.void),
        Effect.flatMap(() =>
          services.inventoryService.addBlock(filledBucket, 1).pipe(Effect.catchAll(() => Effect.void)),
        ),
      )
    }),
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
      Effect.flatMap(() => services.inventoryService.removeBlock(bucketItem, 1, slot).pipe(Effect.catchAll(() => Effect.void))),
      Effect.flatMap(() => services.inventoryService.addBlock('BUCKET', 1).pipe(Effect.catchAll(() => Effect.void))),
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

    if (item === 'BUCKET') {
      const targetPos = { x: hit.blockX, y: hit.blockY, z: hit.blockZ }
      const blockType = yield* readBlockTypeAt(services.chunkManagerService, targetPos).pipe(
        Effect.catchAll(() => Effect.succeed(null)),
      )
      if (blockType !== 'WATER' && blockType !== 'LAVA') return false
      return yield* fillBucketFromFluidSource(services, refs, slot, targetPos, blockType)
    }

    return yield* emptyBucketIntoWorld(services, refs, slot, hit, item)
  })
