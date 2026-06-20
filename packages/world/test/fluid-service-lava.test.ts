import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { Effect, MutableRef } from 'effect'
import {
  makeEmptyTestChunk as makeEmptyChunk,
} from './chunk-buffer-test-utils'
import { makeFluidTestChunk, withFluidService } from './fluid-test-utils'

describe('terrain/application/fluid-service', () => {
  it.effect('tick handles lateral contact between water and lava (blockAt path)', () => {
    const chunk = makeFluidTestChunk({
      blocks: [
        { lx: 0, y: 64, lz: 0, blockType: 'WATER' },
        { lx: 0, y: 63, lz: 0, blockType: 'STONE' },
        { lx: 1, y: 64, lz: 0, blockType: 'LAVA' },
      ],
      fluids: [
        { lx: 0, y: 64, lz: 0, cell: { level: 0, source: true, type: 'water' } },
        { lx: 1, y: 64, lz: 0, cell: { level: 0, source: true, type: 'lava' } },
      ],
    })
    return withFluidService([chunk], svc => Effect.gen(function* () {
      yield* svc.tick()
    }))
  })

  it.effect('seedLava seeds a lava cell at the given position', () => {
    const markDirtyCalledRef = MutableRef.make(false)
    const chunk = makeEmptyChunk()
    return withFluidService(
      [chunk],
      svc => Effect.gen(function* () {
      yield* svc.seedLava({ x: 0, y: 64, z: 0 })
      expect(MutableRef.get(markDirtyCalledRef)).toBe(true)
      }),
      {
        chunkManagerOverrides: {
          markChunkDirty: () => Effect.sync(() => { MutableRef.set(markDirtyCalledRef, true) }),
        },
      },
    )
  })

  it.effect('tick skips lava spreading on non-lava-tick (lava tick interval)', () => {
    const markDirtyCountRef = MutableRef.make(0)
    const chunk = makeFluidTestChunk({
      blocks: [{ lx: 0, y: 64, lz: 0, blockType: 'LAVA' }],
      fluids: [{ lx: 0, y: 64, lz: 0, cell: { level: 0, source: true, type: 'lava' } }],
    })
    return withFluidService(
      [chunk],
      svc => Effect.gen(function* () {
      yield* svc.tick()
      yield* svc.tick()
      yield* svc.tick()
      }),
      {
        chunkManagerOverrides: {
          markChunkDirty: () => Effect.sync(() => { MutableRef.update(markDirtyCountRef, n => n + 1) }),
        },
      },
    )
  })

  it.effect('removeLava removes the lava fluid cell', () => {
    const markDirtyCalledRef = MutableRef.make(false)
    const chunk = makeFluidTestChunk({
      blocks: [{ lx: 0, y: 64, lz: 0, blockType: 'LAVA' }],
    })
    return withFluidService(
      [chunk],
      svc => Effect.gen(function* () {
      yield* svc.seedLava({ x: 0, y: 64, z: 0 })
      MutableRef.set(markDirtyCalledRef, false)
      yield* svc.removeLava({ x: 0, y: 64, z: 0 })
      expect(MutableRef.get(markDirtyCalledRef)).toBe(true)
      }),
      {
        chunkManagerOverrides: {
          markChunkDirty: () => Effect.sync(() => { MutableRef.set(markDirtyCalledRef, true) }),
        },
      },
    )
  })

  it.effect('tick skips cells whose chunk is not in the loaded cache', () => {
    const chunk = makeEmptyChunk()
    return withFluidService([chunk], svc => Effect.gen(function* () {
      yield* svc.notifyBlockChanged({ x: 0, y: 64, z: 0 })
      yield* svc.tick()
    }), { syncLoadedChunks: false })
  })

  it.effect('tick skips lateral spread into solid (non-air, non-opposite-type) blocks', () => {
    const markDirtyCountRef = MutableRef.make(0)
    const chunk = makeFluidTestChunk({
      blocks: [
        { lx: 0, y: 64, lz: 0, blockType: 'WATER' },
        { lx: 0, y: 63, lz: 0, blockType: 'STONE' },
        { lx: 1, y: 64, lz: 0, blockType: 'STONE' },
        { lx: 15, y: 64, lz: 0, blockType: 'STONE' },
        { lx: 0, y: 64, lz: 1, blockType: 'STONE' },
        { lx: 0, y: 64, lz: 15, blockType: 'STONE' },
      ],
      fluids: [{ lx: 0, y: 64, lz: 0, cell: { level: 0, source: true, type: 'water' } }],
    })
    return withFluidService(
      [chunk],
      svc => Effect.gen(function* () {
      yield* svc.tick()
      }),
      {
        chunkManagerOverrides: {
          markChunkDirty: () => Effect.sync(() => { MutableRef.update(markDirtyCountRef, n => n + 1) }),
        },
      },
    )
  })
})
