import { describe, it } from '@effect/vitest'
import { expect, vi } from 'vitest'
import { Array as Arr, Effect, Layer, Option } from 'effect'
import { BlockService } from '@ts-minecraft/world'
import { ChunkManagerService } from '@ts-minecraft/world'
import { ChunkService } from '@ts-minecraft/world/application/chunk-service'
import { FluidService } from '@ts-minecraft/world'
import { PlayerService } from '@ts-minecraft/entity'
import { InventoryService } from '@ts-minecraft/inventory'
import { HotbarService } from '@ts-minecraft/inventory'
import { FurnaceService } from '@ts-minecraft/inventory'
import { ChestService } from '@ts-minecraft/inventory'
import { blockTypeToIndex, SlotIndex } from '@ts-minecraft/core'
import type { BlockType } from '@ts-minecraft/core'
import { createMockChestService } from './block-service-test-utils'
import { makeChunkBlockBuffer } from './chunk-buffer-test-utils'

const makeBlocks = (overrides: Array<{ idx: number; type: BlockType }> = []): Uint8Array<ArrayBufferLike> => {
  const blocks = makeChunkBlockBuffer()
  Arr.forEach(overrides, ({ idx, type }) => { blocks[idx] = blockTypeToIndex(type) })
  return blocks
}

const BLOCK_IDX_64 = 64

const makeChunk = (blockType: BlockType = 'AIR', localIdx = BLOCK_IDX_64) =>
  ({ coord: { x: 0, z: 0 }, blocks: makeBlocks(blockType !== 'AIR' ? [{ idx: localIdx, type: blockType }] : []), fluid: Option.none() })

const noopFluidService = Layer.succeed(FluidService, {
  _tag: '@minecraft/application/FluidService' as const,
  notifyBlockChanged: () => Effect.void,
  seedWater: () => Effect.void,
  seedLava: () => Effect.void,
  removeWater: () => Effect.void,
  removeLava: () => Effect.void,
  syncLoadedChunks: () => Effect.void,
  tick: () => Effect.void,
} as unknown as FluidService)

const makeChunkManagerLayer = (chunk = makeChunk()) =>
  Layer.succeed(ChunkManagerService, {
    _tag: '@minecraft/application/ChunkManagerService' as const,
    getChunk: () => Effect.succeed(chunk),
    markChunkDirty: () => Effect.void,
    getLoadedChunks: () => Effect.succeed([chunk]),
  } as unknown as ChunkManagerService)

const makePlayerLayer = () =>
  Layer.succeed(PlayerService, {
    _tag: '@minecraft/application/PlayerService' as const,
    getPosition: () => Effect.succeed({ x: 100, y: 100, z: 100 }),
    create: () => Effect.void,
    updatePosition: () => Effect.void,
    updateVelocity: () => Effect.void,
    getState: () => Effect.fail(new Error('not needed') as never),
  } as unknown as PlayerService)

const makeHotbarLayer = (selected: Option.Option<BlockType> = Option.none()) =>
  Layer.succeed(HotbarService, {
    _tag: '@minecraft/application/HotbarService' as const,
    getSelectedBlockType: () => Effect.succeed(selected),
    getSelectedSlot: () => Effect.succeed(SlotIndex.make(0)),
    setSelectedSlot: () => Effect.void,
    getSlots: () => Effect.succeed([]),
    update: () => Effect.void,
  } as unknown as HotbarService)

const makeFurnaceLayer = () =>
  Layer.succeed(FurnaceService, {
    _tag: '@minecraft/application/FurnaceService' as const,
    dismantleFurnace: () => Effect.succeed(true),
    tick: () => Effect.void,
  } as unknown as FurnaceService)

const makeChestLayer = () =>
  Layer.succeed(ChestService, createMockChestService())

// ---------------------------------------------------------------------------
// SILK_TOUCH drop override
// ---------------------------------------------------------------------------

describe('BlockService.breakBlock — SILK_TOUCH', () => {
  it.effect('drops DIAMOND_ORE itself when silkTouch=true, not DIAMOND', () => {
    const chunk = makeChunk('DIAMOND_ORE', BLOCK_IDX_64)
    const addBlockSpy = vi.fn(() => Effect.void)
    const inventoryLayer = Layer.succeed(InventoryService, {
      _tag: '@minecraft/application/InventoryService' as const,
      addBlock: addBlockSpy,
      removeBlock: () => Effect.void,
      getSlot: () => Effect.succeed(Option.none()),
      getHotbarSlots: () => Effect.succeed([]),
      getAllSlots: () => Effect.succeed([]),
      serialize: () => Effect.succeed({ slots: [] }),
      deserialize: () => Effect.void,
      damageSlot: () => Effect.void,
      canMerge: () => false,
    } as unknown as InventoryService)
    const layer = BlockService.Default.pipe(
      Layer.provide(makeChunkManagerLayer(chunk)),
      Layer.provide(ChunkService.Default),
      Layer.provide(noopFluidService),
      Layer.provide(makePlayerLayer()),
      Layer.provide(inventoryLayer),
      Layer.provide(makeHotbarLayer(Option.some('DIAMOND_PICKAXE' as BlockType))),
      Layer.provide(makeFurnaceLayer()),
      Layer.provide(makeChestLayer()),
    )
    return Effect.gen(function* () {
      const svc = yield* BlockService
      yield* svc.breakBlock({ x: 0, y: 64, z: 0 }, true)
      expect(addBlockSpy).toHaveBeenCalledWith('DIAMOND_ORE', 1)
      expect(addBlockSpy).not.toHaveBeenCalledWith('DIAMOND', expect.anything())
    }).pipe(Effect.provide(layer))
  })

  it.effect('drops DIAMOND (processed item) without silkTouch', () => {
    const chunk = makeChunk('DIAMOND_ORE', BLOCK_IDX_64)
    const addBlockSpy = vi.fn(() => Effect.void)
    const inventoryLayer = Layer.succeed(InventoryService, {
      _tag: '@minecraft/application/InventoryService' as const,
      addBlock: addBlockSpy,
      removeBlock: () => Effect.void,
      getSlot: () => Effect.succeed(Option.none()),
      getHotbarSlots: () => Effect.succeed([]),
      getAllSlots: () => Effect.succeed([]),
      serialize: () => Effect.succeed({ slots: [] }),
      deserialize: () => Effect.void,
      damageSlot: () => Effect.void,
      canMerge: () => false,
    } as unknown as InventoryService)
    const layer = BlockService.Default.pipe(
      Layer.provide(makeChunkManagerLayer(chunk)),
      Layer.provide(ChunkService.Default),
      Layer.provide(noopFluidService),
      Layer.provide(makePlayerLayer()),
      Layer.provide(inventoryLayer),
      Layer.provide(makeHotbarLayer(Option.some('DIAMOND_PICKAXE' as BlockType))),
      Layer.provide(makeFurnaceLayer()),
      Layer.provide(makeChestLayer()),
    )
    return Effect.gen(function* () {
      const svc = yield* BlockService
      yield* svc.breakBlock({ x: 0, y: 64, z: 0 })
      expect(addBlockSpy).toHaveBeenCalledWith('DIAMOND', 1)
      expect(addBlockSpy).not.toHaveBeenCalledWith('DIAMOND_ORE', expect.anything())
    }).pipe(Effect.provide(layer))
  })
})
