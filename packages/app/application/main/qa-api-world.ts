import { Effect, MutableRef, Option, Schema } from 'effect'
import type * as THREE from 'three'
import { BlockTypeSchema, SlotIndex } from '@ts-minecraft/core'
import { HOTBAR_START } from '@ts-minecraft/inventory'
import type { BlockService, ChunkManagerService } from '@ts-minecraft/world'
import { setBlockInChunk } from '@ts-minecraft/world'
import type { HotbarService } from '@ts-minecraft/inventory'
import type { WorldRendererService } from '@ts-minecraft/rendering'
import type { BlockHighlightService } from '@ts-minecraft/presentation/highlight/block-highlight'
import { getChunkAccessForWorldPosition, projectBlockAhead } from '@ts-minecraft/app/main/qa-spatial'
import type { StagedResourceBlock, StagedZombiePosition } from '@ts-minecraft/app/main/qa-api-types'

export const stageProgressionScenario = (
  camera: THREE.PerspectiveCamera,
  scene: THREE.Scene,
  chunkManagerService: ChunkManagerService,
  worldRendererService: WorldRendererService,
  blockHighlight: BlockHighlightService,
  stagedResourceBlocksRef: MutableRef.MutableRef<Array<StagedResourceBlock>>,
  stagedZombiePositionRef: MutableRef.MutableRef<StagedZombiePosition>,
) =>
  Effect.runPromise(Effect.gen(function* () {
    MutableRef.set(stagedResourceBlocksRef, [])
    MutableRef.set(stagedZombiePositionRef, null)

    const placeBlockAhead = (distance: number) =>
      Effect.gen(function* () {
        const worldPos = projectBlockAhead(camera, distance)
        const { chunkCoord, lx, lz } = getChunkAccessForWorldPosition(worldPos)
        const chunk = yield* chunkManagerService.getChunk(chunkCoord)
        yield* setBlockInChunk(chunk, lx, worldPos.y, lz, 'WOOD')
        yield* chunkManagerService.markChunkDirty(chunkCoord, [{ lx, y: worldPos.y, lz }])
        yield* worldRendererService.updateChunkInScene(chunk, scene).pipe(Effect.catchAllCause(() => Effect.void))
        MutableRef.set(stagedResourceBlocksRef, [...MutableRef.get(stagedResourceBlocksRef), { pos: worldPos, blockType: 'WOOD' }])
      })

    yield* placeBlockAhead(4)
    yield* placeBlockAhead(5)
    yield* placeBlockAhead(6)
    yield* blockHighlight.invalidateCache()
  }))

export const collectStagedResources = (
  blockService: BlockService,
  stagedResourceBlocksRef: MutableRef.MutableRef<Array<StagedResourceBlock>>,
) =>
  Effect.runPromise(Effect.gen(function* () {
    for (const { pos } of MutableRef.get(stagedResourceBlocksRef)) {
      yield* blockService.breakBlock(pos)
    }
    MutableRef.set(stagedResourceBlocksRef, [])
  }))

export const stageBuildSupportBlock = (
  camera: THREE.PerspectiveCamera,
  scene: THREE.Scene,
  chunkManagerService: ChunkManagerService,
  worldRendererService: WorldRendererService,
  blockHighlight: BlockHighlightService,
) =>
  Effect.runPromise(Effect.gen(function* () {
    const worldPos = projectBlockAhead(camera, 3)
    const { chunkCoord, lx, lz } = getChunkAccessForWorldPosition(worldPos)
    const chunk = yield* chunkManagerService.getChunk(chunkCoord)
    yield* setBlockInChunk(chunk, lx, worldPos.y, lz, 'STONE')
    yield* chunkManagerService.markChunkDirty(chunkCoord, [{ lx, y: worldPos.y, lz }])
    yield* worldRendererService.updateChunkInScene(chunk, scene).pipe(Effect.catchAllCause(() => Effect.void))
    yield* blockHighlight.invalidateCache()
  }))

export const placeSelectedItemInFront = (
  camera: THREE.PerspectiveCamera,
  hotbarService: HotbarService,
  blockService: BlockService,
  blockHighlight: BlockHighlightService,
) =>
  Effect.runPromise(Effect.gen(function* () {
    const selectedItem = yield* hotbarService.getSelectedBlockType()
    const selectedSlot = yield* hotbarService.getSelectedSlot()
    const item = Option.getOrNull(selectedItem)
    if (item !== null && Schema.is(BlockTypeSchema)(item)) {
      yield* blockService.placeBlock(
        projectBlockAhead(camera, 4),
        item,
        SlotIndex.make(HOTBAR_START + SlotIndex.toNumber(selectedSlot)),
      ).pipe(Effect.catchAllCause(() => Effect.void))
    }
    yield* blockHighlight.invalidateCache()
  }))

export const clearBlocksInFront = (
  camera: THREE.PerspectiveCamera,
  blockService: BlockService,
  blockHighlight: BlockHighlightService,
) =>
  Effect.runPromise(Effect.gen(function* () {
    for (const distance of [3, 4] as const) {
      const pos = projectBlockAhead(camera, distance)
      yield* blockService.breakBlock(pos).pipe(Effect.catchAllCause(() => Effect.void))
    }
    yield* blockHighlight.invalidateCache()
  }))
