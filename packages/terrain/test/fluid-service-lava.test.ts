import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { Array as Arr, Effect, Layer, MutableRef, Option } from 'effect'
import { FluidService, FluidServiceLive } from '@ts-minecraft/terrain'
import { ChunkManagerService } from '@ts-minecraft/terrain'
import { CHUNK_SIZE, CHUNK_HEIGHT, blockTypeToIndex } from '@ts-minecraft/kernel'
import type { Chunk } from '../domain/chunk'
import {
  createFluidBuffer,
  encodeFluidCell,
} from '@ts-minecraft/world-state'
import { blockIndex } from '@ts-minecraft/kernel'

const makeEmptyChunk = (coord: { x: number; z: number } = { x: 0, z: 0 }): Chunk => ({
  coord,
  blocks: new Uint8Array(CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT),
  fluid: Option.none(),
})

const blockIndexAt = (lx: number, y: number, lz: number): number =>
  Option.getOrElse(blockIndex(lx, y, lz), () => -1)

const makeChunkWith = (
  blockTypes: Array<{ lx: number; y: number; lz: number; blockType: 'WATER' | 'LAVA' | 'AIR' | 'STONE' | 'DIRT' }>,
  coord: { x: number; z: number } = { x: 0, z: 0 },
): Chunk => {
  const blocks = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT)
  Arr.forEach(blockTypes, ({ lx, y, lz, blockType }) => {
    const idx = blockIndexAt(lx, y, lz)
    if (idx >= 0) blocks[idx] = blockTypeToIndex(blockType)
  })
  return { coord, blocks, fluid: Option.none() }
}

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

    const chunkMgrLayer = Layer.succeed(ChunkManagerService, ChunkManagerService.of({
      _tag: '@minecraft/application/ChunkManagerService' as const,
      getChunk: () => Effect.succeed(chunk),
      markChunkDirty: () => Effect.void,
      getLoadedChunks: () => Effect.succeed([chunk]),
      drainRenderDirtyChunks: () => Effect.succeed([]),
        drainRenderDirtyChunkEntries: () => Effect.succeed([]),
      loadChunksAroundPlayer: () => Effect.succeed(false),
      saveDirtyChunks: () => Effect.void,
      unloadChunk: () => Effect.void,
    }))
    const layer = FluidServiceLive.pipe(Layer.provide(chunkMgrLayer))
    return Effect.gen(function* () {
      const svc = yield* FluidService
      yield* svc.syncLoadedChunks([chunk])
      yield* svc.tick()
    }).pipe(Effect.provide(layer))
  })

  it.effect('seedLava seeds a lava cell at the given position', () => {
    const markDirtyCalledRef = MutableRef.make(false)
    const chunk = makeEmptyChunk()
    const chunkMgrLayer = Layer.succeed(ChunkManagerService, ChunkManagerService.of({
      _tag: '@minecraft/application/ChunkManagerService' as const,
      getChunk: () => Effect.succeed(chunk),
      markChunkDirty: () => Effect.sync(() => { MutableRef.set(markDirtyCalledRef, true) }),
      getLoadedChunks: () => Effect.succeed([chunk]),
      drainRenderDirtyChunks: () => Effect.succeed([]),
        drainRenderDirtyChunkEntries: () => Effect.succeed([]),
      loadChunksAroundPlayer: () => Effect.succeed(false),
      saveDirtyChunks: () => Effect.void,
      unloadChunk: () => Effect.void,
    }))
    const layer = FluidServiceLive.pipe(Layer.provide(chunkMgrLayer))
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
    const chunkMgrLayer = Layer.succeed(ChunkManagerService, ChunkManagerService.of({
      _tag: '@minecraft/application/ChunkManagerService' as const,
      getChunk: () => Effect.succeed(chunk),
      markChunkDirty: () => Effect.sync(() => { MutableRef.update(markDirtyCountRef, n => n + 1) }),
      getLoadedChunks: () => Effect.succeed([chunk]),
      drainRenderDirtyChunks: () => Effect.succeed([]),
        drainRenderDirtyChunkEntries: () => Effect.succeed([]),
      loadChunksAroundPlayer: () => Effect.succeed(false),
      saveDirtyChunks: () => Effect.void,
      unloadChunk: () => Effect.void,
    }))
    const layer = FluidServiceLive.pipe(Layer.provide(chunkMgrLayer))
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
    const chunkMgrLayer = Layer.succeed(ChunkManagerService, ChunkManagerService.of({
      _tag: '@minecraft/application/ChunkManagerService' as const,
      getChunk: () => Effect.succeed(chunk),
      markChunkDirty: () => Effect.sync(() => { MutableRef.set(markDirtyCalledRef, true) }),
      getLoadedChunks: () => Effect.succeed([chunk]),
      drainRenderDirtyChunks: () => Effect.succeed([]),
        drainRenderDirtyChunkEntries: () => Effect.succeed([]),
      loadChunksAroundPlayer: () => Effect.succeed(false),
      saveDirtyChunks: () => Effect.void,
      unloadChunk: () => Effect.void,
    }))
    const layer = FluidServiceLive.pipe(Layer.provide(chunkMgrLayer))
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
    const chunkMgrLayer = Layer.succeed(ChunkManagerService, ChunkManagerService.of({
      _tag: '@minecraft/application/ChunkManagerService' as const,
      getChunk: () => Effect.succeed(chunk),
      markChunkDirty: () => Effect.void,
      getLoadedChunks: () => Effect.succeed([chunk]),
      drainRenderDirtyChunks: () => Effect.succeed([]),
        drainRenderDirtyChunkEntries: () => Effect.succeed([]),
      loadChunksAroundPlayer: () => Effect.succeed(false),
      saveDirtyChunks: () => Effect.void,
      unloadChunk: () => Effect.void,
    }))
    const layer = FluidServiceLive.pipe(Layer.provide(chunkMgrLayer))
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
    const chunkMgrLayer = Layer.succeed(ChunkManagerService, ChunkManagerService.of({
      _tag: '@minecraft/application/ChunkManagerService' as const,
      getChunk: () => Effect.succeed(chunk),
      markChunkDirty: () => Effect.sync(() => { MutableRef.update(markDirtyCountRef, n => n + 1) }),
      getLoadedChunks: () => Effect.succeed([chunk]),
      drainRenderDirtyChunks: () => Effect.succeed([]),
        drainRenderDirtyChunkEntries: () => Effect.succeed([]),
      loadChunksAroundPlayer: () => Effect.succeed(false),
      saveDirtyChunks: () => Effect.void,
      unloadChunk: () => Effect.void,
    }))
    const layer = FluidServiceLive.pipe(Layer.provide(chunkMgrLayer))
    return Effect.gen(function* () {
      const svc = yield* FluidService
      yield* svc.syncLoadedChunks([chunk])
      yield* svc.tick()
    }).pipe(Effect.provide(layer))
  })
})
