import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { Array as Arr, Effect, Either, Layer, Option } from 'effect'
import { BlockService } from '@ts-minecraft/world'
import { ChunkManagerService } from '@ts-minecraft/world'
import { ChunkService } from '@ts-minecraft/world/application/chunk-service'
import { FluidService } from '@ts-minecraft/world'
import { PlayerService } from '@ts-minecraft/entity'
import { InventoryService } from '@ts-minecraft/inventory'
import { HotbarService } from '@ts-minecraft/inventory'
import { FurnaceService } from '@ts-minecraft/inventory'
import { ChestService } from '@ts-minecraft/inventory'
import { blockTypeToIndex, Position, SlotIndex } from '@ts-minecraft/core'
import type { BlockType } from '@ts-minecraft/core'
import { createMockChestService } from './block-service-test-utils'
import { makeChunkBlockBuffer } from './chunk-buffer-test-utils'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makeBlocks = (overrides: Array<{ idx: number; type: BlockType }> = []): Uint8Array<ArrayBufferLike> => {
  const blocks = makeChunkBlockBuffer()
  Arr.forEach(overrides, ({ idx, type }) => {
    blocks[idx] = blockTypeToIndex(type)
  })
  return blocks
}

const BLOCK_IDX_64 = 64

const makeChunk = (blockType: BlockType = 'AIR', localIdx = BLOCK_IDX_64) =>
  ({
    coord: { x: 0, z: 0 },
    blocks: makeBlocks(blockType !== 'AIR' ? [{ idx: localIdx, type: blockType }] : []),
    fluid: Option.none(),
  })

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

const makeChunkManagerLayer = (opts: {
  chunk?: ReturnType<typeof makeChunk>
} = {}) => {
  const chunk = opts.chunk ?? makeChunk()
  return Layer.succeed(ChunkManagerService, {
    _tag: '@minecraft/application/ChunkManagerService' as const,
    getChunk: () => Effect.succeed(chunk),
    markChunkDirty: () => Effect.void,
    getLoadedChunks: () => Effect.succeed([chunk]),
  } as unknown as ChunkManagerService)
}

const makePlayerLayer = (pos: Position = { x: 100, y: 100, z: 100 }) =>
  Layer.succeed(PlayerService, {
    _tag: '@minecraft/application/PlayerService' as const,
    getPosition: () => Effect.succeed(pos),
    create: () => Effect.void,
    updatePosition: () => Effect.void,
    updateVelocity: () => Effect.void,
    getState: () => Effect.fail(new Error('not needed') as never),
  } as unknown as PlayerService)

const makeInventoryLayer = () =>
  Layer.succeed(InventoryService, {
    _tag: '@minecraft/application/InventoryService' as const,
    addBlock: () => Effect.succeed(true),
    removeBlock: () => Effect.succeed(true),
    getSlot: () => Effect.succeed(Option.none()),
    getHotbarSlots: () => Effect.succeed([]),
    getAllSlots: () => Effect.succeed([]),
    serialize: () => Effect.succeed({ slots: [] }),
    deserialize: () => Effect.void,
  } as unknown as InventoryService)

const makeHotbarLayer = () =>
  Layer.succeed(HotbarService, {
    _tag: '@minecraft/application/HotbarService' as const,
    getSelectedBlockType: () => Effect.succeed(Option.none()),
    getSelectedSlot: () => Effect.succeed(SlotIndex.make(0)),
    setSelectedSlot: () => Effect.void,
    getSlots: () => Effect.succeed([]),
    update: () => Effect.void,
  } as unknown as HotbarService)

const makeFurnaceLayer = (opts: {
  dismantleResult?: boolean
} = {}) =>
  Layer.succeed(FurnaceService, {
    _tag: '@minecraft/application/FurnaceService' as const,
    dismantleFurnace: () => Effect.succeed(opts.dismantleResult ?? true),
    registerFurnace: () => Effect.void,
    unregisterFurnace: () => Effect.void,
    setSelectedFurnace: () => Effect.void,
    startSmelting: () => Effect.void,
    tick: () => Effect.void,
    collectOutput: () => Effect.void,
    getNearestFurnaceState: () => Effect.succeed(Option.none()),
    getFurnaceState: () => Effect.succeed(Option.none()),
    serialize: () => Effect.succeed([]),
    deserialize: () => Effect.void,
  } as unknown as FurnaceService)

const makeChestLayer = () =>
  Layer.succeed(ChestService, createMockChestService())

// ---------------------------------------------------------------------------
// breakBlock — FURNACE path
// ---------------------------------------------------------------------------

describe('terrain/application/block-service breakBlock furnace', () => {
  it.effect('breakBlock on FURNACE succeeds when dismantleFurnace returns true', () => {
    const chunk = makeChunk('FURNACE', BLOCK_IDX_64)
    const layer = BlockService.Default.pipe(
      Layer.provide(makeChunkManagerLayer({ chunk })),
      Layer.provide(ChunkService.Default),
      Layer.provide(noopFluidService),
      Layer.provide(makePlayerLayer()),
      Layer.provide(makeInventoryLayer()),
      Layer.provide(makeHotbarLayer()),
      Layer.provide(makeFurnaceLayer({ dismantleResult: true })),
      Layer.provide(makeChestLayer()),
    )
    return Effect.gen(function* () {
      const svc = yield* BlockService
      const result = yield* Effect.either(svc.breakBlock({ x: 0, y: 64, z: 0 }))
      expect(Either.isRight(result)).toBe(true)
    }).pipe(Effect.provide(layer))
  })

  it.effect('breakBlock on FURNACE fails when dismantleFurnace returns false', () => {
    const chunk = makeChunk('FURNACE', BLOCK_IDX_64)
    const layer = BlockService.Default.pipe(
      Layer.provide(makeChunkManagerLayer({ chunk })),
      Layer.provide(ChunkService.Default),
      Layer.provide(noopFluidService),
      Layer.provide(makePlayerLayer()),
      Layer.provide(makeInventoryLayer()),
      Layer.provide(makeHotbarLayer()),
      Layer.provide(makeFurnaceLayer({ dismantleResult: false })),
      Layer.provide(makeChestLayer()),
    )
    return Effect.gen(function* () {
      const svc = yield* BlockService
      const result = yield* Effect.either(svc.breakBlock({ x: 0, y: 64, z: 0 }))
      expect(Either.isLeft(result)).toBe(true)
      const err = Option.getOrThrow(Either.getLeft(result))
      expect(err.operation).toBe('breakBlock')
      expect(err.reason).toContain('Cannot break furnace')
    }).pipe(Effect.provide(layer))
  })
})
