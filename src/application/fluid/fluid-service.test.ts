import { describe, expect, it } from '@effect/vitest'
import { Effect, Layer, Option } from 'effect'
import { ChunkManagerService } from '@/application/chunk/chunk-manager-service'
import { ChunkService, ChunkServiceLive, blockIndex, blockTypeToIndex, setBlockInChunk } from '@/domain/chunk'
import { FluidService, FluidServiceLive } from './fluid-service'

const makeChunkManager = (loadedChunks: ReadonlyArray<{ coord: { x: number; z: number }; blocks: Uint8Array }>) =>
  Layer.succeed(ChunkManagerService, {
    getLoadedChunks: () => Effect.succeed(loadedChunks),
    markChunkDirty: () => Effect.void,
  } as unknown as ChunkManagerService)

describe('application/fluid/fluid-service', () => {
  it('seeds water blocks into loaded chunks', async () => {
    const chunk = await Effect.runPromise(
      Effect.gen(function* () {
        const chunkService = yield* ChunkService
        return yield* chunkService.createChunk({ x: 0, z: 0 })
      }).pipe(Effect.provide(ChunkServiceLive))
    )

    const loadedChunks = [chunk]
    const layer = Layer.mergeAll(
      ChunkServiceLive,
      FluidServiceLive.pipe(Layer.provide(makeChunkManager(loadedChunks))),
    )

    const program = Effect.gen(function* () {
      const fluid = yield* FluidService
      yield* fluid.seedWater({ x: 4, y: 10, z: 4 })
      return chunk.blocks[Option.getOrElse(blockIndex(4, 10, 4), () => -1)]
    }).pipe(Effect.provide(layer))

    const result = await Effect.runPromise(program)
    expect(result).toBe(blockTypeToIndex('WATER'))
  })

  it('spreads a source downward on tick', async () => {
    const chunk = await Effect.runPromise(
      Effect.gen(function* () {
        const chunkService = yield* ChunkService
        return yield* chunkService.createChunk({ x: 0, z: 0 })
      }).pipe(Effect.provide(ChunkServiceLive))
    )

    await Effect.runPromise(
      setBlockInChunk(chunk, 4, 10, 4, 'WATER')
    )

    const loadedChunks = [chunk]
    const layer = Layer.mergeAll(
      ChunkServiceLive,
      FluidServiceLive.pipe(Layer.provide(makeChunkManager(loadedChunks))),
    )

    const program = Effect.gen(function* () {
      const fluid = yield* FluidService
      yield* fluid.syncLoadedChunks(loadedChunks)
      yield* fluid.tick()
      return chunk.blocks[Option.getOrElse(blockIndex(4, 9, 4), () => -1)]
    }).pipe(Effect.provide(layer))

    const result = await Effect.runPromise(program)
    expect(result).toBe(blockTypeToIndex('WATER'))
  })
})
