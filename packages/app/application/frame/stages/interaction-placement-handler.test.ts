import { describe, it } from '@effect/vitest'
import { Effect, HashMap, MutableRef, Option, Ref } from 'effect'
import { expect, vi } from 'vitest'
import { CHUNK_SIZE, CHUNK_HEIGHT, blockTypeToIndex } from '@ts-minecraft/core'
import type { BlockType } from '@ts-minecraft/core'
import type { Chunk } from '@ts-minecraft/world'
import { handleFlintAndSteel, handleBucket, handleBed } from '@ts-minecraft/app/frame/stages/interaction-placement-handler'
import type { TargetRayHit } from '@ts-minecraft/app/frame/stages/interaction-types'

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

// Portal frame: 2-wide × 3-tall, x-axis aligned (fixed z=0).
// Interior (AIR): x∈{0,1}, y∈{64,65,66}, z=0
// Frame edges (OBSIDIAN, corners excluded per vanilla):
//   bottom: (0,63,0),(1,63,0) — chunk (0,0): lx=0,1 y=63 lz=0
//   top:    (0,67,0),(1,67,0) — chunk (0,0): lx=0,1 y=67 lz=0
//   right:  (2,64..66,0)       — chunk (0,0): lx=2   y=64-66 lz=0
//   left:   (−1,64..66,0)      — chunk (−1,0): lx=15 y=64-66 lz=0
const makePortalChunkMap = (): Map<string, Chunk> => {
  const c0 = makeEmptyChunk(0, 0)
  setChunkBlock(c0, 0, 63, 0, 'OBSIDIAN')
  setChunkBlock(c0, 1, 63, 0, 'OBSIDIAN')
  setChunkBlock(c0, 0, 67, 0, 'OBSIDIAN')
  setChunkBlock(c0, 1, 67, 0, 'OBSIDIAN')
  setChunkBlock(c0, 2, 64, 0, 'OBSIDIAN')
  setChunkBlock(c0, 2, 65, 0, 'OBSIDIAN')
  setChunkBlock(c0, 2, 66, 0, 'OBSIDIAN')

  const cNeg1 = makeEmptyChunk(-1, 0)
  // x=−1 → cx=floor(−1/16)=−1, lx=((−1%16)+16)%16=15
  setChunkBlock(cNeg1, 15, 64, 0, 'OBSIDIAN')
  setChunkBlock(cNeg1, 15, 65, 0, 'OBSIDIAN')
  setChunkBlock(cNeg1, 15, 66, 0, 'OBSIDIAN')

  return new Map([['0,0', c0], ['-1,0', cNeg1]])
}

// A TargetRayHit on the bottom OBSIDIAN block's top face → ignitionPos = (0,64,0) = interior AIR
const makePortalHit = (): TargetRayHit => ({
  blockX: 0,
  blockY: 63,
  blockZ: 0,
  distance: 3,
  normal: { x: 0, y: 1, z: 0 },
})

const makeServices = (opts: {
  forceSetBlockSpy?: ReturnType<typeof vi.fn>
  registerPortalSpy?: ReturnType<typeof vi.fn>
  getChunkFn?: (coord: { x: number; z: number }) => Effect.Effect<Chunk, Error>
} = {}) => {
  const forceSetBlockSpy = opts.forceSetBlockSpy ?? vi.fn(() => Effect.void)
  const registerPortalSpy = opts.registerPortalSpy ?? vi.fn(() => Effect.void)
  return {
    blockService: { forceSetBlock: forceSetBlockSpy },
    chunkManagerService: {
      getChunk: opts.getChunkFn ?? ((_coord) => Effect.succeed(makeEmptyChunk(0, 0))),
    },
    netherService: { registerPortal: registerPortalSpy },
    soundManager: { playEffect: vi.fn(() => Effect.void) },
    _forceSetBlockSpy: forceSetBlockSpy,
    _registerPortalSpy: registerPortalSpy,
  } as unknown as {
    blockService: { forceSetBlock: ReturnType<typeof vi.fn> }
    chunkManagerService: { getChunk: (coord: { x: number; z: number }) => Effect.Effect<Chunk, Error> }
    netherService: { registerPortal: ReturnType<typeof vi.fn> }
    soundManager: { playEffect: ReturnType<typeof vi.fn> }
    _forceSetBlockSpy: ReturnType<typeof vi.fn>
    _registerPortalSpy: ReturnType<typeof vi.fn>
  }
}

// ---------------------------------------------------------------------------
// tests
// ---------------------------------------------------------------------------

describe('interaction-placement-handler / handleFlintAndSteel', () => {
  it.effect('returns false immediately when targetHit is none', () =>
    Effect.gen(function* () {
      const dirtyChunksRef = yield* Ref.make(HashMap.empty<string, unknown>())
      const services = makeServices()
      const result = yield* handleFlintAndSteel(
        services as never,
        { dirtyChunksRef } as never,
        { targetHit: Option.none() },
      )
      expect(result).toBe(false)
    }),
  )

  it.effect('returns false when target is hit but no valid OBSIDIAN frame surrounds ignition', () =>
    Effect.gen(function* () {
      const dirtyChunksRef = yield* Ref.make(HashMap.empty<string, unknown>())
      const services = makeServices({
        // All chunks are empty (AIR) — no portal frame
        getChunkFn: (coord) => Effect.succeed(makeEmptyChunk(coord.x, coord.z)),
      })
      const hit: TargetRayHit = { blockX: 10, blockY: 64, blockZ: 10, distance: 3, normal: { x: 0, y: 1, z: 0 } }
      const result = yield* handleFlintAndSteel(
        services as never,
        { dirtyChunksRef } as never,
        { targetHit: Option.some(hit) },
      )
      expect(result).toBe(false)
    }),
  )

  it.effect('ignites portal and returns true when a valid 2×3 OBSIDIAN frame is present', () =>
    Effect.gen(function* () {
      const dirtyChunksRef = yield* Ref.make(HashMap.empty<string, unknown>())
      const portalChunks = makePortalChunkMap()
      const forceSetBlockSpy = vi.fn(() => Effect.void)
      const registerPortalSpy = vi.fn(() => Effect.void)
      const services = makeServices({
        forceSetBlockSpy,
        registerPortalSpy,
        getChunkFn: (coord) => {
          const key = `${coord.x},${coord.z}`
          const chunk = portalChunks.get(key) ?? makeEmptyChunk(coord.x, coord.z)
          return Effect.succeed(chunk)
        },
      })

      const result = yield* handleFlintAndSteel(
        services as never,
        { dirtyChunksRef } as never,
        { targetHit: Option.some(makePortalHit()) },
      )

      // 6 interior cells (2 wide × 3 tall) each receive NETHER_PORTAL
      expect(forceSetBlockSpy).toHaveBeenCalledTimes(6)
      expect(registerPortalSpy).toHaveBeenCalledOnce()
      expect(result).toBe(true)
    }),
  )

  it.effect('still returns true when forceSetBlock fails (errors are caught per-block)', () =>
    Effect.gen(function* () {
      const dirtyChunksRef = yield* Ref.make(HashMap.empty<string, unknown>())
      const portalChunks = makePortalChunkMap()
      const services = makeServices({
        // forceSetBlock always fails — errors are caught individually, should not abort portal
        forceSetBlockSpy: vi.fn(() => Effect.fail(new Error('chunk error'))),
        getChunkFn: (coord) => Effect.succeed(portalChunks.get(`${coord.x},${coord.z}`) ?? makeEmptyChunk(coord.x, coord.z)),
      })

      const result = yield* handleFlintAndSteel(
        services as never,
        { dirtyChunksRef } as never,
        { targetHit: Option.some(makePortalHit()) },
      )
      expect(result).toBe(true)
    }),
  )
})

// ---------------------------------------------------------------------------
// R26: water/lava buckets
// ---------------------------------------------------------------------------

const makeBucketServices = (heldItem: BlockType | string, targetBlock: BlockType = 'AIR') => {
  const removeBlock = vi.fn(() => Effect.void)
  const addBlock = vi.fn(() => Effect.void)
  const forceSetBlock = vi.fn(() => Effect.void)
  const seedWater = vi.fn(() => Effect.void)
  const seedLava = vi.fn(() => Effect.void)
  const removeWater = vi.fn(() => Effect.void)
  const removeLava = vi.fn(() => Effect.void)
  const notifyBlockChanged = vi.fn(() => Effect.void)
  // A chunk whose voxel (lx=0,y=63,lz=0) carries the target block — this is the
  // voxel `bucketHit` points AT, which the FILL branch reads to detect a source.
  const chunk = makeEmptyChunk(0, 0)
  setChunkBlock(chunk, 0, 63, 0, targetBlock)
  const services = {
    hotbarService: {
      getSelectedBlockType: () => Effect.succeed(Option.some(heldItem)),
      getSelectedSlot: () => Effect.succeed(0),
    },
    inventoryService: { removeBlock, addBlock },
    blockService: { forceSetBlock },
    chunkManagerService: { getChunk: () => Effect.succeed(chunk) },
    fluidService: { seedWater, seedLava, removeWater, removeLava, notifyBlockChanged },
    soundManager: { playEffect: vi.fn(() => Effect.void) },
  }
  return { services, spies: { removeBlock, addBlock, forceSetBlock, seedWater, seedLava, removeWater, removeLava } }
}

// hit on the top face of block (0,63,0) → adjacent air = (0,64,0); also the
// FILL target voxel the mock chunk is seeded at.
const bucketHit: TargetRayHit = { blockX: 0, blockY: 63, blockZ: 0, distance: 3, normal: { x: 0, y: 1, z: 0 } }

describe('interaction-placement-handler / handleBucket', () => {
  it.effect('returns false for a non-bucket held item', () =>
    Effect.gen(function* () {
      const dirtyChunksRef = yield* Ref.make(HashMap.empty<string, unknown>())
      const { services } = makeBucketServices('STONE')
      const result = yield* handleBucket(services as never, { dirtyChunksRef } as never, { targetHit: Option.some(bucketHit) })
      expect(result).toBe(false)
    }),
  )

  it.effect('empties a WATER_BUCKET: seeds water at the adjacent cell and swaps to an empty BUCKET', () =>
    Effect.gen(function* () {
      const dirtyChunksRef = yield* Ref.make(HashMap.empty<string, unknown>())
      const { services, spies } = makeBucketServices('WATER_BUCKET')
      const result = yield* handleBucket(services as never, { dirtyChunksRef } as never, { targetHit: Option.some(bucketHit) })
      expect(result).toBe(true)
      expect(spies.seedWater).toHaveBeenCalledOnce()
      expect(spies.seedLava).not.toHaveBeenCalled()
      expect(spies.removeBlock).toHaveBeenCalledWith('WATER_BUCKET', 1, expect.anything())
      expect(spies.addBlock).toHaveBeenCalledWith('BUCKET', 1)
    }),
  )

  it.effect('fills an empty BUCKET from a WATER source: removes the water and swaps to WATER_BUCKET', () =>
    Effect.gen(function* () {
      const dirtyChunksRef = yield* Ref.make(HashMap.empty<string, unknown>())
      const { services, spies } = makeBucketServices('BUCKET', 'WATER')
      const result = yield* handleBucket(services as never, { dirtyChunksRef } as never, { targetHit: Option.some(bucketHit) })
      expect(result).toBe(true)
      expect(spies.removeWater).toHaveBeenCalledOnce()
      expect(spies.removeBlock).toHaveBeenCalledWith('BUCKET', 1, expect.anything())
      expect(spies.addBlock).toHaveBeenCalledWith('WATER_BUCKET', 1)
    }),
  )

  it.effect('an empty BUCKET aimed at a non-fluid block does nothing (returns false)', () =>
    Effect.gen(function* () {
      const dirtyChunksRef = yield* Ref.make(HashMap.empty<string, unknown>())
      const { services, spies } = makeBucketServices('BUCKET', 'STONE')
      const result = yield* handleBucket(services as never, { dirtyChunksRef } as never, { targetHit: Option.some(bucketHit) })
      expect(result).toBe(false)
      expect(spies.removeWater).not.toHaveBeenCalled()
      expect(spies.addBlock).not.toHaveBeenCalled()
    }),
  )

  it.effect('empties a LAVA_BUCKET: seeds lava and swaps to an empty BUCKET', () =>
    Effect.gen(function* () {
      const dirtyChunksRef = yield* Ref.make(HashMap.empty<string, unknown>())
      const { services, spies } = makeBucketServices('LAVA_BUCKET')
      const result = yield* handleBucket(services as never, { dirtyChunksRef } as never, { targetHit: Option.some(bucketHit) })
      expect(result).toBe(true)
      expect(spies.seedLava).toHaveBeenCalledOnce()
      expect(spies.addBlock).toHaveBeenCalledWith('BUCKET', 1)
    }),
  )
})

// ---------------------------------------------------------------------------
// TNT explosion via handleFlintAndSteel
// ---------------------------------------------------------------------------

describe('interaction-placement-handler / handleFlintAndSteel (TNT)', () => {
  const makeTntServices = (forceSetBlockSpy = vi.fn(() => Effect.void)) => {
    // Chunk containing a TNT block at world position (0, 64, 0): lx=0, y=64, lz=0
    const chunk = makeEmptyChunk(0, 0)
    setChunkBlock(chunk, 0, 64, 0, 'TNT')
    return {
      services: {
        blockService: { forceSetBlock: forceSetBlockSpy },
        chunkManagerService: { getChunk: () => Effect.succeed(chunk) },
        netherService: { registerPortal: vi.fn(() => Effect.void) },
        soundManager: { playEffect: vi.fn(() => Effect.void) },
      },
      forceSetBlockSpy,
    }
  }

  const tntHit: TargetRayHit = { blockX: 0, blockY: 64, blockZ: 0, distance: 2, normal: { x: 0, y: 1, z: 0 } }

  it.effect('explodes TNT: breaks all blocks in radius sphere and returns true', () =>
    Effect.gen(function* () {
      const dirtyChunksRef = yield* Ref.make(HashMap.empty<string, unknown>())
      const { services, forceSetBlockSpy } = makeTntServices()
      const result = yield* handleFlintAndSteel(
        services as never,
        { dirtyChunksRef } as never,
        { targetHit: Option.some(tntHit) },
      )
      expect(result).toBe(true)
      // TNT block removed (1 call) + explosion sphere positions (many calls)
      expect(forceSetBlockSpy.mock.calls.length).toBeGreaterThan(1)
      // First call removes the TNT itself
      expect(forceSetBlockSpy.mock.calls[0]?.[1]).toBe('AIR')
    }),
  )

  it.effect('returns true even when forceSetBlock fails during explosion', () =>
    Effect.gen(function* () {
      const dirtyChunksRef = yield* Ref.make(HashMap.empty<string, unknown>())
      const { services } = makeTntServices(vi.fn(() => Effect.fail(new Error('write error'))))
      const result = yield* handleFlintAndSteel(
        services as never,
        { dirtyChunksRef } as never,
        { targetHit: Option.some(tntHit) },
      )
      expect(result).toBe(true)
    }),
  )
})

// ---------------------------------------------------------------------------
// handleBed
// ---------------------------------------------------------------------------

const makeBedServices = (opts: {
  isNight?: boolean
  dimension?: string
}) => ({
  timeService: {
    isNight: () => Effect.succeed(opts.isNight ?? true),
    setTimeOfDay: vi.fn(() => Effect.void),
  },
  netherService: {
    getDimension: () => Effect.succeed(opts.dimension ?? 'overworld'),
  },
  soundManager: { playEffect: vi.fn(() => Effect.void) },
})

describe('interaction-placement-handler / handleBed', () => {
  const bedPos = { x: 5, y: 64, z: 5 }

  it.effect('skips to dawn and sets spawn when it is night in the overworld', () =>
    Effect.gen(function* () {
      const respawnRef = MutableRef.make({ x: 0, y: 64, z: 0 })
      const services = makeBedServices({ isNight: true, dimension: 'overworld' })
      const result = yield* handleBed(services as never, respawnRef, bedPos)
      expect(result).toBe(true)
      expect((services.timeService.setTimeOfDay as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith(0.25)
      expect(MutableRef.get(respawnRef).y).toBe(bedPos.y + 1)
    }),
  )

  it.effect('returns false and does nothing during daytime', () =>
    Effect.gen(function* () {
      const respawnRef = MutableRef.make({ x: 0, y: 64, z: 0 })
      const services = makeBedServices({ isNight: false, dimension: 'overworld' })
      const result = yield* handleBed(services as never, respawnRef, bedPos)
      expect(result).toBe(false)
      expect((services.timeService.setTimeOfDay as ReturnType<typeof vi.fn>)).not.toHaveBeenCalled()
    }),
  )

  it.effect('returns false in the nether without calling setTimeOfDay', () =>
    Effect.gen(function* () {
      const respawnRef = MutableRef.make({ x: 0, y: 64, z: 0 })
      const services = makeBedServices({ isNight: true, dimension: 'nether' })
      const result = yield* handleBed(services as never, respawnRef, bedPos)
      expect(result).toBe(false)
      expect((services.timeService.setTimeOfDay as ReturnType<typeof vi.fn>)).not.toHaveBeenCalled()
    }),
  )
})
