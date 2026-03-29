import { describe, expect, it } from '@effect/vitest'
import { Effect, Layer, Option } from 'effect'
import { ChunkManagerService } from '@/application/chunk/chunk-manager-service'
import { ChunkService, ChunkServiceLive, blockIndex, blockTypeToIndex, setBlockInChunk } from '@/domain/chunk'
import { encodeFluidCell } from '@/domain/fluid'
import { FluidService, FluidServiceLive } from './fluid-service'

const makeChunkManager = (loadedChunks: ReadonlyArray<{ coord: { x: number; z: number }; blocks: Uint8Array; fluid: Option.Option<Uint8Array> }>) => {
  const dirtyCalls: Array<{ x: number; z: number }> = []
  const layer = Layer.succeed(ChunkManagerService, {
    getLoadedChunks: () => Effect.succeed(loadedChunks),
    markChunkDirty: (coord: { x: number; z: number }) => Effect.sync(() => {
      dirtyCalls.push(coord)
    }),
  } satisfies Pick<ChunkManagerService, 'getLoadedChunks' | 'markChunkDirty'> as ChunkManagerService)

  return { layer, dirtyCalls }
}

describe('application/fluid/fluid-service', () => {
  it.effect('seeds water blocks into loaded chunks', () =>
    Effect.gen(function* () {
      const chunkService = yield* ChunkService
      const chunk = yield* chunkService.createChunk({ x: 0, z: 0 })

      const { layer: chunkManagerLayer, dirtyCalls } = makeChunkManager([chunk])
      const blockIdx = yield* Effect.gen(function* () {
        const fluid = yield* FluidService
        yield* fluid.seedWater({ x: 4, y: 10, z: 4 })
        return Option.getOrElse(blockIndex(4, 10, 4), () => -1)
      }).pipe(Effect.provide(FluidServiceLive.pipe(Layer.provide(chunkManagerLayer))))

      expect(chunk.blocks[blockIdx]).toBe(blockTypeToIndex('WATER'))
      expect(dirtyCalls).toHaveLength(1)
      expect(dirtyCalls[0]).toEqual({ x: 0, z: 0 })
    }).pipe(Effect.provide(ChunkServiceLive))
  )

  it.effect('spreads a source downward on tick', () =>
    Effect.gen(function* () {
      const chunkService = yield* ChunkService
      let chunk = yield* chunkService.createChunk({ x: 0, z: 0 })
      yield* setBlockInChunk(chunk, 4, 10, 4, 'WATER')
      const sourceIdx = Option.getOrElse(blockIndex(4, 10, 4), () => -1)
      const fluidBuffer = new Uint8Array(chunk.blocks.length)
      if (sourceIdx >= 0) {
        fluidBuffer[sourceIdx] = encodeFluidCell({ level: 0, source: true })
      }
      chunk = { ...chunk, fluid: Option.some(fluidBuffer) } as typeof chunk

      const { layer: chunkManagerLayer, dirtyCalls } = makeChunkManager([chunk])
      const blockIdx = yield* Effect.gen(function* () {
        const fluid = yield* FluidService
        yield* fluid.syncLoadedChunks([chunk])
        yield* fluid.tick()
        return Option.getOrElse(blockIndex(4, 9, 4), () => -1)
      }).pipe(Effect.provide(FluidServiceLive.pipe(Layer.provide(chunkManagerLayer))))

      expect(chunk.blocks[blockIdx]).toBe(blockTypeToIndex('WATER'))
      expect(dirtyCalls.length).toBeGreaterThan(0)
    }).pipe(Effect.provide(ChunkServiceLive))
  )
})
