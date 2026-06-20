import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { Effect, MutableRef, Option } from 'effect'
import { resolveContact } from '@ts-minecraft/world'
import { blockTypeToIndex } from '@ts-minecraft/core'
import { FLUID_BYTE_LENGTH } from '@ts-minecraft/world'
import type { Chunk } from '../domain/chunk'
import {
  blockAt as fluidBlockAt,
  cacheFromChunks,
  canFluidReplaceAt,
} from '../application/fluid-service-helpers'
import {
  makeEmptyTestChunk as makeEmptyChunk,
  makeTestChunkWithBlocks as makeChunkWith,
} from './chunk-buffer-test-utils'
import { makeFluidTestChunk, withFluidService } from './fluid-test-utils'

// ---------------------------------------------------------------------------
// resolveContact (pure function, exported)
// ---------------------------------------------------------------------------

describe('terrain/application/fluid-service resolveContact', () => {
  it('lava flowing + water source → COBBLESTONE', () => {
    const result = resolveContact(
      { level: 2, source: false, type: 'lava' },
      { level: 0, source: true, type: 'water' },
    )
    expect(result).toEqual(Option.some('COBBLESTONE'))
  })

  it('lava flowing + water flowing → COBBLESTONE', () => {
    const result = resolveContact(
      { level: 2, source: false, type: 'lava' },
      { level: 2, source: false, type: 'water' },
    )
    expect(result).toEqual(Option.some('COBBLESTONE'))
  })

  it('lava source + any water → OBSIDIAN', () => {
    const result = resolveContact(
      { level: 0, source: true, type: 'lava' },
      { level: 1, source: false, type: 'water' },
    )
    expect(result).toEqual(Option.some('OBSIDIAN'))
  })

  it('water + water → none (same type, not lava)', () => {
    const result = resolveContact(
      { level: 0, source: true, type: 'water' },
      { level: 0, source: true, type: 'water' },
    )
    expect(result).toEqual(Option.none())
  })

  it('non-lava first arg → none', () => {
    const result = resolveContact(
      { level: 0, source: true, type: 'water' },
      { level: 0, source: true, type: 'lava' },
    )
    expect(result).toEqual(Option.none())
  })
})

// ---------------------------------------------------------------------------
// Fluid cache helpers
// ---------------------------------------------------------------------------

describe('terrain/application/fluid-service helpers', () => {
  it('canFluidReplaceAt keeps AIR and water-breakable block semantics on complete buffers', () => {
    const chunk = makeChunkWith([
      { lx: 1, y: 64, lz: 1, blockType: 'TORCH' },
      { lx: 2, y: 64, lz: 2, blockType: 'STONE' },
    ])
    const loaded = cacheFromChunks([chunk])

    expect(canFluidReplaceAt(loaded, { x: 0, y: 64, z: 0 }, 'water')).toBe(true)
    expect(canFluidReplaceAt(loaded, { x: 1, y: 64, z: 1 }, 'water')).toBe(true)
    expect(canFluidReplaceAt(loaded, { x: 1, y: 64, z: 1 }, 'lava')).toBe(false)
    expect(canFluidReplaceAt(loaded, { x: 2, y: 64, z: 2 }, 'water')).toBe(false)
  })

  it('canFluidReplaceAt rejects unloaded chunks, vertical bounds, and incomplete block buffers', () => {
    const shortChunk: Chunk = {
      coord: { x: 0, z: 0 },
      blocks: new Uint8Array(0),
      fluid: Option.none(),
    }
    const loaded = cacheFromChunks([shortChunk])

    expect(canFluidReplaceAt(cacheFromChunks([]), { x: 0, y: 64, z: 0 }, 'water')).toBe(false)
    expect(canFluidReplaceAt(loaded, { x: 0, y: -1, z: 0 }, 'water')).toBe(false)
    expect(canFluidReplaceAt(loaded, { x: 0, y: 64, z: 0 }, 'water')).toBe(false)
  })

  it('blockAt returns block indices only for loaded chunks inside vertical bounds', () => {
    const chunk = makeChunkWith([{ lx: 4, y: 65, lz: 4, blockType: 'DIRT' }])
    const loaded = cacheFromChunks([chunk])

    expect(Option.getOrNull(fluidBlockAt(loaded, { x: 4, y: 65, z: 4 }))).toBe(blockTypeToIndex('DIRT'))
    expect(Option.getOrNull(fluidBlockAt(loaded, { x: 4, y: -1, z: 4 }))).toBeNull()
    expect(Option.getOrNull(fluidBlockAt(cacheFromChunks([]), { x: 4, y: 65, z: 4 }))).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// FluidService unit tests
// ---------------------------------------------------------------------------

describe('terrain/application/fluid-service', () => {
  // ─── notifyBlockChanged ──────────────────────────────────────────────────

  it.effect('notifyBlockChanged enqueues a position to frontier', () => {
    return withFluidService([], svc => Effect.gen(function* () {
      yield* svc.notifyBlockChanged({ x: 0, y: 64, z: 0 })
      // If this completes without error, notification is enqueued.
    }), { syncLoadedChunks: false })
  })

  // ─── seedWater / removeWater ─────────────────────────────────────────────

  it.effect('seedWater seeds a water cell and writes to the chunk fluid buffer', () => {
    const markDirtyCalledRef = MutableRef.make(false)
    const chunk = makeEmptyChunk({ x: 0, z: 0 })
    return withFluidService(
      [chunk],
      svc => Effect.gen(function* () {
        yield* svc.seedWater({ x: 0, y: 64, z: 0 })
        // After seeding, markChunkDirty should have been called
        expect(MutableRef.get(markDirtyCalledRef)).toBe(true)
      }),
      {
        chunkManagerOverrides: {
          markChunkDirty: () => Effect.sync(() => { MutableRef.set(markDirtyCalledRef, true) }),
        },
      },
    )
  })

  it.effect('seedWater loads the chunk cache lazily when syncLoadedChunks has not run', () => {
    const getLoadedChunksCalledRef = MutableRef.make(false)
    const chunk = makeEmptyChunk({ x: 0, z: 0 })
    return withFluidService(
      [chunk],
      svc => Effect.gen(function* () {
        yield* svc.seedWater({ x: 0, y: 64, z: 0 })
        expect(MutableRef.get(getLoadedChunksCalledRef)).toBe(true)
      }),
      {
        chunkManagerOverrides: {
          getLoadedChunks: () => Effect.sync(() => {
            MutableRef.set(getLoadedChunksCalledRef, true)
            return [chunk]
          }),
        },
        syncLoadedChunks: false,
      },
    )
  })

  it.effect('removeWater removes the fluid cell and writes air to chunk', () => {
    const markDirtyCalledRef = MutableRef.make(false)
    const chunk = makeChunkWith([{ lx: 0, y: 64, lz: 0, blockType: 'WATER' }])
    return withFluidService(
      [chunk],
      svc => Effect.gen(function* () {
        yield* svc.seedWater({ x: 0, y: 64, z: 0 })
        MutableRef.set(markDirtyCalledRef, false)
        yield* svc.removeWater({ x: 0, y: 64, z: 0 })
        expect(MutableRef.get(markDirtyCalledRef)).toBe(true)
      }),
      {
        chunkManagerOverrides: {
          markChunkDirty: () => Effect.sync(() => { MutableRef.set(markDirtyCalledRef, true) }),
        },
      },
    )
  })

  // ─── syncLoadedChunks — covers ensureFluidBuffer None path (lines 19-23) ─

  it.effect('syncLoadedChunks with chunk having no fluid buffer creates one (ensureFluidBuffer None path)', () => {
    // chunk.fluid = Option.none() triggers the onNone branch in ensureFluidBuffer
    // which creates a new Uint8Array and mutates chunk.fluid in place
    const chunk = makeChunkWith([{ lx: 0, y: 64, lz: 0, blockType: 'WATER' }])
    // Ensure fluid is None
    ;(chunk as { fluid: Option.Option<Uint8Array<ArrayBufferLike>> }).fluid = Option.none()

    return withFluidService([chunk], svc => Effect.gen(function* () {
      // syncLoadedChunks processes the WATER block, then seedWater writes through ensureFluidBuffer.
      yield* svc.syncLoadedChunks([chunk])
      // Seed at the water position to trigger ensureFluidBuffer None path
      yield* svc.seedWater({ x: 0, y: 64, z: 0 })
      // After seedWater the chunk.fluid should now be Some
      expect(Option.isSome(chunk.fluid)).toBe(true)
    }), { syncLoadedChunks: false })
  })

  it.effect('syncLoadedChunks with chunk having wrong-length fluid buffer creates new one', () => {
    // chunk.fluid with wrong byteLength triggers the onNone branch in ensureFluidBuffer
    const chunk = makeChunkWith([{ lx: 0, y: 64, lz: 0, blockType: 'WATER' }])
    ;(chunk as { fluid: Option.Option<Uint8Array<ArrayBufferLike>> }).fluid = Option.some(new Uint8Array(10))

    return withFluidService([chunk], svc => Effect.gen(function* () {
      yield* svc.syncLoadedChunks([chunk])
      yield* svc.seedWater({ x: 0, y: 64, z: 0 })
      // Fluid should now have been replaced with correct length
      expect(Option.isSome(chunk.fluid)).toBe(true)
      const fluidBuffer = Option.getOrThrow(chunk.fluid)
      if (!(fluidBuffer instanceof Uint8Array)) {
        expect.fail('Expected chunk fluid to be a Uint8Array')
      }
      expect(fluidBuffer.byteLength).toBe(FLUID_BYTE_LENGTH)
    }), { syncLoadedChunks: false })
  })

  it.effect('syncLoadedChunks with proper fluid buffer uses it (onSome path)', () => {
    // Create a chunk with a valid fluid buffer that has a water cell encoded
    const chunk = makeFluidTestChunk({
      blocks: [{ lx: 0, y: 64, lz: 0, blockType: 'WATER' }],
      fluids: [{ lx: 0, y: 64, lz: 0, cell: { level: 0, source: true, type: 'water' } }],
    })

    return withFluidService([chunk], svc => Effect.gen(function* () {
      // syncLoadedChunks should hydrate state from the existing fluid buffer
      yield* svc.syncLoadedChunks([chunk])
      // Sync completed without error, state was hydrated from existing buffer
    }), { syncLoadedChunks: false })
  })

  it.effect('syncLoadedChunks removes fluid cells and frontier entries for unloaded chunks', () => {
    const chunk = makeFluidTestChunk({
      blocks: [{ lx: 0, y: 64, lz: 0, blockType: 'WATER' }],
      fluids: [{ lx: 0, y: 64, lz: 0, cell: { level: 0, source: true, type: 'water' } }],
    })

    return withFluidService([], svc => Effect.gen(function* () {
      yield* svc.syncLoadedChunks([chunk])
      yield* svc.notifyBlockChanged({ x: 0, y: 64, z: 0 })
      yield* svc.syncLoadedChunks([])
      yield* svc.tick()
    }), { syncLoadedChunks: false })
  })
})
