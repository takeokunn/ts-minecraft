import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { Array as Arr, Effect, Either, Layer, MutableRef, Option } from 'effect'
import { BlockService, BlockServiceError, ChunkManagerService, FluidService } from '@ts-minecraft/world'
import { ChunkService } from '@ts-minecraft/world/application/chunk-service'
import { ChestService, FurnaceService, HotbarService, InventoryService } from '@ts-minecraft/inventory'
import { PlayerService } from '@ts-minecraft/entity'
import { Position, SlotIndex, blockTypeToIndex } from '@ts-minecraft/core'
import type { BlockType } from '@ts-minecraft/core'
import { createMockChestService } from './block-service-test-utils'
import { makeChunkBlockBuffer } from './chunk-buffer-test-utils'

const BLOCK_IDX_64 = 64
const makeBlocks = (overrides: Array<{ idx: number; type: BlockType }> = []): Uint8Array<ArrayBufferLike> => {
  const blocks = makeChunkBlockBuffer()
  Arr.forEach(overrides, ({ idx, type }) => { blocks[idx] = blockTypeToIndex(type) })
  return blocks
}
const makeChunk = (blockType: BlockType = 'AIR', localIdx = BLOCK_IDX_64) => ({
  coord: { x: 0, z: 0 },
  blocks: makeBlocks(blockType !== 'AIR' ? [{ idx: localIdx, type: blockType }] : []),
  fluid: Option.none(),
})
const makeChunkManagerLayer = (chunk = makeChunk()) => Layer.succeed(ChunkManagerService, {
  _tag: '@minecraft/application/ChunkManagerService' as const,
  getChunk: () => Effect.succeed(chunk),
  markChunkDirty: () => Effect.void,
  getLoadedChunks: () => Effect.succeed([chunk]),
  drainRenderDirtyChunks: () => Effect.succeed([]),
  drainRenderDirtyChunkEntries: () => Effect.succeed([]),
  loadChunksAroundPlayer: () => Effect.succeed(false),
  saveDirtyChunks: () => Effect.void,
  unloadChunk: () => Effect.void,
} as unknown as ChunkManagerService)
const makePlayerLayer = (pos: Position = { x: 100, y: 100, z: 100 }) => Layer.succeed(PlayerService, {
  _tag: '@minecraft/application/PlayerService' as const,
  getPosition: () => Effect.succeed(pos), create: () => Effect.void, updatePosition: () => Effect.void,
  updateVelocity: () => Effect.void, getState: () => Effect.fail(new Error('not needed') as never),
} as unknown as PlayerService)
const makeInventoryLayer = () => Layer.succeed(InventoryService, {
  _tag: '@minecraft/application/InventoryService' as const,
  addBlock: () => Effect.void, removeBlock: () => Effect.void, getSlot: () => Effect.succeed(Option.none()),
  getHotbarSlots: () => Effect.succeed([]), getAllSlots: () => Effect.succeed([]),
  serialize: () => Effect.succeed({ slots: [] }), deserialize: () => Effect.void,
} as unknown as InventoryService)
const makeHotbarLayer = () => Layer.succeed(HotbarService, {
  _tag: '@minecraft/application/HotbarService' as const,
  getSelectedBlockType: () => Effect.succeed(Option.none()), getSelectedSlot: () => Effect.succeed(SlotIndex.make(0)),
  setSelectedSlot: () => Effect.void, getSlots: () => Effect.succeed([]), update: () => Effect.void,
} as unknown as HotbarService)
const makeFurnaceLayer = () => Layer.succeed(FurnaceService, {
  _tag: '@minecraft/application/FurnaceService' as const,
  dismantleFurnace: () => Effect.succeed(true), registerFurnace: () => Effect.void, unregisterFurnace: () => Effect.void,
  setSelectedFurnace: () => Effect.void, startSmelting: () => Effect.void, tick: () => Effect.void,
  collectOutput: () => Effect.void, getNearestFurnaceState: () => Effect.succeed(Option.none()),
  getFurnaceState: () => Effect.succeed(Option.none()), serialize: () => Effect.succeed([]), deserialize: () => Effect.void,
} as unknown as FurnaceService)
const makeChestLayer = () => Layer.succeed(ChestService, createMockChestService())
const noopFluidService = Layer.succeed(FluidService, {
  _tag: '@minecraft/application/FluidService' as const,
  notifyBlockChanged: () => Effect.void, seedWater: () => Effect.void, seedLava: () => Effect.void,
  removeWater: () => Effect.void, removeLava: () => Effect.void, syncLoadedChunks: () => Effect.void, tick: () => Effect.void,
} as unknown as FluidService)
const buildLayer = (chunk: ReturnType<typeof makeChunk>, fluidSvc: Layer.Layer<FluidService>) => BlockService.Default.pipe(
  Layer.provide(makeChunkManagerLayer(chunk)), Layer.provide(ChunkService.Default), Layer.provide(fluidSvc),
  Layer.provide(makePlayerLayer()), Layer.provide(makeInventoryLayer()), Layer.provide(makeHotbarLayer()), Layer.provide(makeFurnaceLayer()),
  Layer.provide(makeChestLayer()),
)

describe('terrain/application/block-service fluid placement hooks', () => {
  it.effect('placeBlock LAVA block triggers seedLava', () => {
    const called = MutableRef.make(false)
    const layer = buildLayer(makeChunk('AIR'), Layer.succeed(FluidService, {
      _tag: '@minecraft/application/FluidService' as const,
      notifyBlockChanged: () => Effect.void, seedWater: () => Effect.void, seedLava: () => Effect.sync(() => { MutableRef.set(called, true) }),
      removeWater: () => Effect.void, removeLava: () => Effect.void, syncLoadedChunks: () => Effect.void, tick: () => Effect.void,
    } as unknown as FluidService))
    return Effect.gen(function* () {
      const svc = yield* BlockService
      expect(Either.isRight(yield* Effect.either(svc.placeBlock({ x: 0, y: 64, z: 0 }, 'LAVA')))).toBe(true)
      expect(MutableRef.get(called)).toBe(true)
    }).pipe(Effect.provide(layer))
  })

  it.effect('breakBlock on WATER block triggers removeWater', () => {
    const called = MutableRef.make(false)
    const layer = buildLayer(makeChunk('WATER'), Layer.succeed(FluidService, {
      _tag: '@minecraft/application/FluidService' as const,
      notifyBlockChanged: () => Effect.void, seedWater: () => Effect.void, seedLava: () => Effect.void,
      removeWater: () => Effect.sync(() => { MutableRef.set(called, true) }), removeLava: () => Effect.void,
      syncLoadedChunks: () => Effect.void, tick: () => Effect.void,
    } as unknown as FluidService))
    return Effect.gen(function* () {
      const svc = yield* BlockService
      expect(Either.isRight(yield* Effect.either(svc.breakBlock({ x: 0, y: 64, z: 0 })))).toBe(true)
      expect(MutableRef.get(called)).toBe(true)
    }).pipe(Effect.provide(layer))
  })

  it.effect('breakBlock on LAVA block triggers removeLava', () => {
    const called = MutableRef.make(false)
    const layer = buildLayer(makeChunk('LAVA'), Layer.succeed(FluidService, {
      _tag: '@minecraft/application/FluidService' as const,
      notifyBlockChanged: () => Effect.void, seedWater: () => Effect.void, seedLava: () => Effect.void,
      removeWater: () => Effect.void, removeLava: () => Effect.sync(() => { MutableRef.set(called, true) }),
      syncLoadedChunks: () => Effect.void, tick: () => Effect.void,
    } as unknown as FluidService))
    return Effect.gen(function* () {
      const svc = yield* BlockService
      expect(Either.isRight(yield* Effect.either(svc.breakBlock({ x: 0, y: 64, z: 0 })))).toBe(true)
      expect(MutableRef.get(called)).toBe(true)
    }).pipe(Effect.provide(layer))
  })

  it.effect('breakBlock on AIR fails with "No block" error', () => Effect.gen(function* () {
    const svc = yield* BlockService
    const result = yield* Effect.either(svc.breakBlock({ x: 0, y: 64, z: 0 }))
    expect(Either.isLeft(result)).toBe(true)
    expect(Option.getOrThrow(Either.getLeft(result)).reason).toContain('No block at position')
  }).pipe(Effect.provide(buildLayer(makeChunk('AIR'), noopFluidService))))
})

describe('BlockServiceError', () => {
  it('formats optional causes', () => {
    expect(new BlockServiceError({ operation: 'breakBlock', reason: 'failed', cause: new Error('inner') }).message).toContain('inner')
    expect(new BlockServiceError({ operation: 'breakBlock', reason: 'failed', cause: 'raw cause' }).message).toContain('raw cause')
    expect(new BlockServiceError({ operation: 'breakBlock', reason: 'no cause' }).message).toContain('breakBlock')
  })
})
