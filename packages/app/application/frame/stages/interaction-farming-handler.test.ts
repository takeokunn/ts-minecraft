import { describe, it } from '@effect/vitest'
import { Effect, HashMap, Option, Ref } from 'effect'
import { expect, vi } from 'vitest'
import { CHUNK_SIZE, CHUNK_HEIGHT, blockTypeToIndex, SlotIndex } from '@ts-minecraft/core'
import type { BlockType } from '@ts-minecraft/core'
import type { Chunk } from '@ts-minecraft/world'
import { handleFarmingInteraction } from '@ts-minecraft/app/frame/stages/interaction-farming-handler'
import type { TargetRayHit } from '@ts-minecraft/app/frame/stages/interaction-block-handler'
import { HOTBAR_START } from '@ts-minecraft/inventory'

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

const makeEmptyChunk = (cx: number, cz: number): Chunk => ({
  coord: { x: cx, z: cz },
  blocks: new Uint8Array(CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT),
  fluid: Option.none(),
})

const setChunkBlock = (chunk: Chunk, lx: number, y: number, lz: number, type: BlockType): void => {
  chunk.blocks[y + lz * CHUNK_HEIGHT + lx * CHUNK_HEIGHT * CHUNK_SIZE] = blockTypeToIndex(type)
}

/** blockX=2,y=64,z=3 in chunk(0,0): lx=2, lz=3 */
const makeHit = (bx: number, by: number, bz: number): TargetRayHit => ({
  blockX: bx,
  blockY: by,
  blockZ: bz,
  distance: 3,
  normal: { x: 0, y: 1, z: 0 },
})

const makeServices = (opts: {
  selectedItem?: string | null
  selectedSlot?: number
  getChunkFn?: (coord: { x: number; z: number }) => Effect.Effect<Chunk, Error>
  forceSetBlockSpy?: ReturnType<typeof vi.fn>
  removeBlockSpy?: ReturnType<typeof vi.fn>
  plantSpy?: ReturnType<typeof vi.fn>
} = {}) => {
  const forceSetBlockSpy = opts.forceSetBlockSpy ?? vi.fn(() => Effect.void)
  const removeBlockSpy = opts.removeBlockSpy ?? vi.fn(() => Effect.void)
  const plantSpy = opts.plantSpy ?? vi.fn(() => Effect.void)
  return {
    hotbarService: {
      getSelectedBlockType: vi.fn(() =>
        Effect.succeed(opts.selectedItem === null ? Option.none() : Option.some(opts.selectedItem ?? 'STONE')),
      ),
      getSelectedSlot: vi.fn(() => Effect.succeed(opts.selectedSlot ?? 0)),
    },
    blockService: { forceSetBlock: forceSetBlockSpy },
    chunkManagerService: {
      getChunk: opts.getChunkFn ?? ((_coord) => Effect.succeed(makeEmptyChunk(0, 0))),
    },
    soundManager: { playEffect: vi.fn(() => Effect.void) },
    inventoryService: { removeBlock: removeBlockSpy },
    cropGrowthService: { plant: plantSpy, harvest: vi.fn(() => Effect.succeed(true)), tickAll: vi.fn(() => Effect.void) },
    _forceSetBlockSpy: forceSetBlockSpy,
    _removeBlockSpy: removeBlockSpy,
    _plantSpy: plantSpy,
  } as unknown as {
    hotbarService: { getSelectedBlockType: ReturnType<typeof vi.fn>; getSelectedSlot: ReturnType<typeof vi.fn> }
    blockService: { forceSetBlock: ReturnType<typeof vi.fn> }
    chunkManagerService: { getChunk: (coord: { x: number; z: number }) => Effect.Effect<Chunk, Error> }
    soundManager: { playEffect: ReturnType<typeof vi.fn> }
    inventoryService: { removeBlock: ReturnType<typeof vi.fn> }
    cropGrowthService: { plant: ReturnType<typeof vi.fn>; harvest: ReturnType<typeof vi.fn>; tickAll: ReturnType<typeof vi.fn> }
    _forceSetBlockSpy: ReturnType<typeof vi.fn>
    _removeBlockSpy: ReturnType<typeof vi.fn>
    _plantSpy: ReturnType<typeof vi.fn>
  }
}

// ---------------------------------------------------------------------------
// tests
// ---------------------------------------------------------------------------

describe('handleFarmingInteraction', () => {
  it.effect('returns false immediately when targetHit is none', () =>
    Effect.gen(function* () {
      const dirtyChunksRef = yield* Ref.make(HashMap.empty<string, unknown>())
      const services = makeServices({ selectedItem: 'WOODEN_HOE' })
      const result = yield* handleFarmingInteraction(
        services as never,
        { dirtyChunksRef } as never,
        { targetHit: Option.none() },
      )
      expect(result).toBe(false)
    }),
  )

  it.effect('returns false when selected item is not a hoe or wheat seeds (e.g. STONE)', () =>
    Effect.gen(function* () {
      const dirtyChunksRef = yield* Ref.make(HashMap.empty<string, unknown>())
      const chunk = makeEmptyChunk(0, 0)
      setChunkBlock(chunk, 2, 64, 3, 'DIRT')
      const services = makeServices({
        selectedItem: 'STONE',
        getChunkFn: (_c) => Effect.succeed(chunk),
      })
      const result = yield* handleFarmingInteraction(
        services as never,
        { dirtyChunksRef } as never,
        { targetHit: Option.some(makeHit(2, 64, 3)) },
      )
      expect(result).toBe(false)
      expect(services._forceSetBlockSpy).not.toHaveBeenCalled()
    }),
  )

  it.effect('returns false when item is an ItemType but not a hoe or WHEAT_SEEDS (e.g. APPLE)', () =>
    Effect.gen(function* () {
      // APPLE passes Schema.is(ItemTypeSchema) but is neither HOE nor WHEAT_SEEDS → hits the
      // final `return Effect.succeed(false)` fallthrough at the bottom of the handler.
      const dirtyChunksRef = yield* Ref.make(HashMap.empty<string, unknown>())
      const chunk = makeEmptyChunk(0, 0)
      setChunkBlock(chunk, 2, 64, 3, 'DIRT')
      const services = makeServices({
        selectedItem: 'APPLE',
        getChunkFn: (_c) => Effect.succeed(chunk),
      })
      const result = yield* handleFarmingInteraction(
        services as never,
        { dirtyChunksRef } as never,
        { targetHit: Option.some(makeHit(2, 64, 3)) },
      )
      expect(result).toBe(false)
      expect(services._forceSetBlockSpy).not.toHaveBeenCalled()
    }),
  )

  it.effect('returns false when no item is selected', () =>
    Effect.gen(function* () {
      const dirtyChunksRef = yield* Ref.make(HashMap.empty<string, unknown>())
      const services = makeServices({ selectedItem: null })
      const result = yield* handleFarmingInteraction(
        services as never,
        { dirtyChunksRef } as never,
        { targetHit: Option.some(makeHit(0, 64, 0)) },
      )
      expect(result).toBe(false)
    }),
  )

  it.effect('tills DIRT → FARMLAND with a wooden hoe and returns true', () =>
    Effect.gen(function* () {
      const dirtyChunksRef = yield* Ref.make(HashMap.empty<string, unknown>())
      const chunk = makeEmptyChunk(0, 0)
      setChunkBlock(chunk, 0, 64, 0, 'DIRT')
      const services = makeServices({
        selectedItem: 'WOODEN_HOE',
        getChunkFn: (_c) => Effect.succeed(chunk),
      })
      const result = yield* handleFarmingInteraction(
        services as never,
        { dirtyChunksRef } as never,
        { targetHit: Option.some(makeHit(0, 64, 0)) },
      )
      expect(result).toBe(true)
      expect(services._forceSetBlockSpy).toHaveBeenCalledWith({ x: 0, y: 64, z: 0 }, 'FARMLAND')
    }),
  )

  it.effect('tills GRASS → FARMLAND with an iron hoe and returns true', () =>
    Effect.gen(function* () {
      const dirtyChunksRef = yield* Ref.make(HashMap.empty<string, unknown>())
      const chunk = makeEmptyChunk(0, 0)
      setChunkBlock(chunk, 5, 70, 3, 'GRASS')
      const services = makeServices({
        selectedItem: 'IRON_HOE',
        getChunkFn: (_c) => Effect.succeed(chunk),
      })
      const result = yield* handleFarmingInteraction(
        services as never,
        { dirtyChunksRef } as never,
        { targetHit: Option.some(makeHit(5, 70, 3)) },
      )
      expect(result).toBe(true)
      expect(services._forceSetBlockSpy).toHaveBeenCalledWith({ x: 5, y: 70, z: 3 }, 'FARMLAND')
    }),
  )

  it.effect('returns false when hoe targets a non-tillable block (e.g. STONE)', () =>
    Effect.gen(function* () {
      const dirtyChunksRef = yield* Ref.make(HashMap.empty<string, unknown>())
      const chunk = makeEmptyChunk(0, 0)
      setChunkBlock(chunk, 0, 64, 0, 'STONE')
      const services = makeServices({
        selectedItem: 'DIAMOND_HOE',
        getChunkFn: (_c) => Effect.succeed(chunk),
      })
      const result = yield* handleFarmingInteraction(
        services as never,
        { dirtyChunksRef } as never,
        { targetHit: Option.some(makeHit(0, 64, 0)) },
      )
      expect(result).toBe(false)
      expect(services._forceSetBlockSpy).not.toHaveBeenCalled()
    }),
  )

  it.effect('plants WHEAT_CROP on FARMLAND with WHEAT_SEEDS and removes one seed', () =>
    Effect.gen(function* () {
      const dirtyChunksRef = yield* Ref.make(HashMap.empty<string, unknown>())
      const chunk = makeEmptyChunk(0, 0)
      setChunkBlock(chunk, 2, 64, 3, 'FARMLAND')
      const selectedSlot = 2
      const services = makeServices({
        selectedItem: 'WHEAT_SEEDS',
        selectedSlot,
        getChunkFn: (_c) => Effect.succeed(chunk),
      })
      const result = yield* handleFarmingInteraction(
        services as never,
        { dirtyChunksRef } as never,
        { targetHit: Option.some(makeHit(2, 64, 3)) },
      )
      expect(result).toBe(true)
      expect(services._removeBlockSpy).toHaveBeenCalledWith(
        'WHEAT_SEEDS',
        1,
        SlotIndex.make(HOTBAR_START + selectedSlot),
      )
      expect(services._forceSetBlockSpy).toHaveBeenCalledWith({ x: 2, y: 65, z: 3 }, 'WHEAT_CROP')
    }),
  )

  it.effect('returns false when WHEAT_SEEDS targets non-FARMLAND block', () =>
    Effect.gen(function* () {
      const dirtyChunksRef = yield* Ref.make(HashMap.empty<string, unknown>())
      const chunk = makeEmptyChunk(0, 0)
      setChunkBlock(chunk, 0, 64, 0, 'DIRT')
      const services = makeServices({
        selectedItem: 'WHEAT_SEEDS',
        getChunkFn: (_c) => Effect.succeed(chunk),
      })
      const result = yield* handleFarmingInteraction(
        services as never,
        { dirtyChunksRef } as never,
        { targetHit: Option.some(makeHit(0, 64, 0)) },
      )
      expect(result).toBe(false)
      expect(services._removeBlockSpy).not.toHaveBeenCalled()
    }),
  )

  it.effect('returns false (not true) when hoe getChunk fails (error is caught)', () =>
    Effect.gen(function* () {
      const dirtyChunksRef = yield* Ref.make(HashMap.empty<string, unknown>())
      const services = makeServices({
        selectedItem: 'STONE_HOE',
        getChunkFn: (_c) => Effect.fail(new Error('chunk not loaded')),
      })
      const result = yield* handleFarmingInteraction(
        services as never,
        { dirtyChunksRef } as never,
        { targetHit: Option.some(makeHit(0, 64, 0)) },
      )
      expect(result).toBe(false)
    }),
  )

  it.effect('registers the planted crop in cropGrowthService.plant', () =>
    Effect.gen(function* () {
      const dirtyChunksRef = yield* Ref.make(HashMap.empty<string, unknown>())
      const chunk = makeEmptyChunk(0, 0)
      setChunkBlock(chunk, 2, 64, 3, 'FARMLAND')
      const selectedSlot = 0
      const services = makeServices({
        selectedItem: 'WHEAT_SEEDS',
        selectedSlot,
        getChunkFn: (_c) => Effect.succeed(chunk),
      })
      yield* handleFarmingInteraction(
        services as never,
        { dirtyChunksRef } as never,
        { targetHit: Option.some(makeHit(2, 64, 3)) },
      )
      // crop at blockY+1 = y65
      expect(services._plantSpy).toHaveBeenCalledWith({ x: 2, y: 65, z: 3 })
    }),
  )

  it.effect('marks the chunk dirty after tilling DIRT with a hoe', () =>
    Effect.gen(function* () {
      const dirtyChunksRef = yield* Ref.make(HashMap.empty<string, unknown>())
      const chunk = makeEmptyChunk(0, 0)
      setChunkBlock(chunk, 0, 64, 0, 'DIRT')
      const services = makeServices({
        selectedItem: 'WOODEN_HOE',
        getChunkFn: (_c) => Effect.succeed(chunk),
      })
      yield* handleFarmingInteraction(
        services as never,
        { dirtyChunksRef } as never,
        { targetHit: Option.some(makeHit(0, 64, 0)) },
      )
      const dirty = yield* Ref.get(dirtyChunksRef)
      expect(HashMap.size(dirty)).toBe(1)
      expect(HashMap.has(dirty, '0,0')).toBe(true)
    }),
  )
})
