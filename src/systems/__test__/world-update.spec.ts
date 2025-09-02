import { Effect, Layer } from 'effect'
import { describe, it, expect } from 'vitest'
import { World, WorldLive } from '@/runtime/world'
import { worldUpdateSystem } from '../world-update'
import { ChunkDataQueueService, RenderQueueService } from '@/runtime/services'
import { ChunkGenerationResult, RenderCommand } from '@/domain/types'
import { PlacedBlock } from '@/domain/block'
import { chunkQuery, terrainBlockQuery } from '@/domain/queries'

const mockChunkData: ChunkGenerationResult = {
  chunkX: 0,
  chunkZ: 0,
  blocks: [
    {
      position: { x: 0, y: 0, z: 0 },
      blockType: 'stone',
    } as PlacedBlock,
  ],
  mesh: {
    positions: new Float32Array([0, 0, 0]),
    normals: new Float32Array([0, 1, 0]),
    uvs: new Float32Array([0, 0]),
    indices: new Uint32Array([0, 1, 2]),
  },
}

describe('worldUpdateSystem', () => {
  it('should process chunk data from the queue and update the world', async () => {
    const chunkDataQueue = [mockChunkData]
    const renderQueue: RenderCommand[] = []
    const MockChunkDataQueue = Layer.succeed(ChunkDataQueueService, chunkDataQueue)
    const MockRenderQueue = Layer.succeed(RenderQueueService, renderQueue)

    const program = Effect.gen(function* (_) {
      const world = yield* _(World)
      yield* _(worldUpdateSystem)

      const chunks = yield* _(world.query(chunkQuery))
      expect(chunks.length).toBe(1)
      expect(chunks[0]?.chunk.chunkX).toBe(0)
      expect(chunks[0]?.chunk.chunkZ).toBe(0)

      const blocks = yield* _(world.query(terrainBlockQuery))
      expect(blocks.length).toBe(1)
      expect(blocks[0]?.position).toEqual({ x: 0, y: 0, z: 0 })

      expect(renderQueue.length).toBe(1)
      expect(renderQueue[0]?.type).toBe('UpsertChunk')
    })

    await Effect.runPromise(Effect.provide(program, Layer.mergeAll(WorldLive, MockChunkDataQueue, MockRenderQueue)))
  })

  it('should do nothing if the chunk data queue is empty', async () => {
    const chunkDataQueue: ChunkGenerationResult[] = []
    const renderQueue: RenderCommand[] = []
    const MockChunkDataQueue = Layer.succeed(ChunkDataQueueService, chunkDataQueue)
    const MockRenderQueue = Layer.succeed(RenderQueueService, renderQueue)

    const program = Effect.gen(function* (_) {
      const world = yield* _(World)
      const initialState = yield* _(world.state.get)
      yield* _(worldUpdateSystem)
      const finalState = yield* _(world.state.get)
      expect(finalState).toEqual(initialState)
      expect(renderQueue.length).toBe(0)
    })

    await Effect.runPromise(Effect.provide(program, Layer.mergeAll(WorldLive, MockChunkDataQueue, MockRenderQueue)))
  })
})