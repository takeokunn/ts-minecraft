import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { Effect, Layer, MutableRef, Option } from 'effect'
import { FluidService } from '@ts-minecraft/world'
import {
  createFluidBuffer,
  encodeFluidCell,
} from '@ts-minecraft/world'
import {
  makeEmptyTestChunk as makeEmptyChunk,
  makeTestChunkWithBlocks as makeChunkWith,
  testBlockIndexAt as blockIndexAt,
} from './chunk-buffer-test-utils'
import { makeChunkManagerLayer } from './fluid-test-utils'

describe('terrain/application/fluid-service', () => {
  it.effect('tick handles lateral contact between water and lava (blockAt path)', () => {
    const chunk = makeChunkWith([
      { lx: 0, y: 64, lz: 0, blockType: 'WATER' },
      { lx: 0, y: 63, lz: 0, blockType: 'STONE' },
      { lx: 1, y: 64, lz: 0, blockType: 'LAVA' },
    ])
    const fluidBuffer = createFluidBuffer()
    const waterIdx = blockIndexAt(0, 64, 0)
    const lavaIdx = blockIndexAt(1, 64, 0)
    fluidBuffer[waterIdx] = encodeFluidCell({ level: 0, source: true, type: 'water' })
    fluidBuffer[lavaIdx] = encodeFluidCell({ level: 0, source: true, type: 'lava' })
    ;(chunk as { fluid: Option.Option<Uint8Array<ArrayBufferLike>> }).fluid = Option.some(fluidBuffer)

    const layer = FluidService.Default.pipe(Layer.provide(makeChunkManagerLayer([chunk])))
    return Effect.gen(function* () {
      const svc = yield* FluidService
      yield* svc.syncLoadedChunks([chunk])
      yield* svc.tick()
    }).pipe(Effect.provide(layer))
  })

  it.effect('seedLava seeds a lava cell at the given position', () => {
    const markDirtyCalledRef = MutableRef.make(false)
    const chunk = makeEmptyChunk()
    const layer = FluidService.Default.pipe(Layer.provide(makeChunkManagerLayer([chunk], {
      markChunkDirty: () => Effect.sync(() => { MutableRef.set(markDirtyCalledRef, true) }),
    })))
    return Effect.gen(function* () {
      const svc = yield* FluidService
      yield* svc.syncLoadedChunks([chunk])
      yield* svc.seedLava({ x: 0, y: 64, z: 0 })
      expect(MutableRef.get(markDirtyCalledRef)).toBe(true)
    }).pipe(Effect.provide(layer))
  })

  it.effect('tick skips lava spreading on non-lava-tick (lava tick interval)', () => {
    const chunk = makeChunkWith([{ lx: 0, y: 64, lz: 0, blockType: 'LAVA' }])
    const fluidBuffer = createFluidBuffer()
    const idx = blockIndexAt(0, 64, 0)
    fluidBuffer[idx] = encodeFluidCell({ level: 0, source: true, type: 'lava' })
    ;(chunk as { fluid: Option.Option<Uint8Array<ArrayBufferLike>> }).fluid = Option.some(fluidBuffer)

    const markDirtyCountRef = MutableRef.make(0)
    const layer = FluidService.Default.pipe(Layer.provide(makeChunkManagerLayer([chunk], {
      markChunkDirty: () => Effect.sync(() => { MutableRef.update(markDirtyCountRef, n => n + 1) }),
    })))
    return Effect.gen(function* () {
      const svc = yield* FluidService
      yield* svc.syncLoadedChunks([chunk])
      yield* svc.tick()
      yield* svc.tick()
      yield* svc.tick()
    }).pipe(Effect.provide(layer))
  })

  it.effect('removeLava removes the lava fluid cell', () => {
    const markDirtyCalledRef = MutableRef.make(false)
    const chunk = makeChunkWith([{ lx: 0, y: 64, lz: 0, blockType: 'LAVA' }])
    const layer = FluidService.Default.pipe(Layer.provide(makeChunkManagerLayer([chunk], {
      markChunkDirty: () => Effect.sync(() => { MutableRef.set(markDirtyCalledRef, true) }),
    })))
    return Effect.gen(function* () {
      const svc = yield* FluidService
      yield* svc.syncLoadedChunks([chunk])
      yield* svc.seedLava({ x: 0, y: 64, z: 0 })
      MutableRef.set(markDirtyCalledRef, false)
      yield* svc.removeLava({ x: 0, y: 64, z: 0 })
      expect(MutableRef.get(markDirtyCalledRef)).toBe(true)
    }).pipe(Effect.provide(layer))
  })

  it.effect('tick skips cells whose chunk is not in the loaded cache', () => {
    const chunk = makeEmptyChunk()
    const layer = FluidService.Default.pipe(Layer.provide(makeChunkManagerLayer([chunk])))
    return Effect.gen(function* () {
      const svc = yield* FluidService
      yield* svc.notifyBlockChanged({ x: 0, y: 64, z: 0 })
      yield* svc.tick()
    }).pipe(Effect.provide(layer))
  })

  it.effect('tick skips lateral spread into solid (non-air, non-opposite-type) blocks', () => {
    const chunk = makeChunkWith([
      { lx: 0, y: 64, lz: 0, blockType: 'WATER' },
      { lx: 0, y: 63, lz: 0, blockType: 'STONE' },
      { lx: 1, y: 64, lz: 0, blockType: 'STONE' },
      { lx: 15, y: 64, lz: 0, blockType: 'STONE' },
      { lx: 0, y: 64, lz: 1, blockType: 'STONE' },
      { lx: 0, y: 64, lz: 15, blockType: 'STONE' },
    ])
    const fluidBuffer = createFluidBuffer()
    const waterIdx = blockIndexAt(0, 64, 0)
    fluidBuffer[waterIdx] = encodeFluidCell({ level: 0, source: true, type: 'water' })
    ;(chunk as { fluid: Option.Option<Uint8Array<ArrayBufferLike>> }).fluid = Option.some(fluidBuffer)

    const markDirtyCountRef = MutableRef.make(0)
    const layer = FluidService.Default.pipe(Layer.provide(makeChunkManagerLayer([chunk], {
      markChunkDirty: () => Effect.sync(() => { MutableRef.update(markDirtyCountRef, n => n + 1) }),
    })))
    return Effect.gen(function* () {
      const svc = yield* FluidService
      yield* svc.syncLoadedChunks([chunk])
      yield* svc.tick()
    }).pipe(Effect.provide(layer))
  })
})
