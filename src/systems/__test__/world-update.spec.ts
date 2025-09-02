import { Effect, Layer, Ref } from 'effect'
import { describe, it, expect } from '@effect/vitest'
import type { RenderQueue } from '@/domain/types'
import { ChunkDataQueueService, RenderQueueService } from '@/runtime/services'
import * as World from '@/domain/world'
import { provideTestLayer } from 'test/utils'
import { worldUpdateSystem } from '../world-update'
import { chunkQuery, terrainBlockQuery } from '@/domain/queries'
import { ChunkGenerationResult, RenderCommand } from '@/domain/types'

describe('worldUpdateSystem', () => {
  it('should process a chunk from the queue and add entities to the world', () =>
    Effect.gen(function* ($) {
      const chunkData: ChunkGenerationResult = {
        blocks: [{ position: { x: 0, y: 0, z: 0 }, blockType: 'dirt' }],
        mesh: { indices: new Uint32Array([1, 2, 3]), positions: new Float32Array(), normals: new Float32Array(), uvs: new Float32Array() },
        chunkX: 0,
        chunkZ: 0,
      }
      const chunkQueue: ChunkGenerationResult[] = [chunkData]
      const renderQueueRef = yield* $(Ref.make<RenderCommand[]>([]))
      const ChunkQueueLayer = Layer.succeed(ChunkDataQueueService, chunkQueue)
      const RenderQueueLayer = Layer.succeed(RenderQueueService, {
        push: (cmd: RenderCommand) => Ref.update(renderQueueRef, (q) => [...q, cmd]),
        splice: (start: number, deleteCount: number) =>
          Effect.gen(function* ($) {
            const q = yield* $(Ref.get(renderQueueRef))
            const removed = q.splice(start, deleteCount)
            yield* $(Ref.set(renderQueueRef, q))
            return removed
          }),
      } as RenderQueue)

      yield* $(Effect.provide(worldUpdateSystem, ChunkQueueLayer.pipe(Layer.provide(RenderQueueLayer))))

      const chunks = yield* $(World.query(chunkQuery))
      const blocks = yield* $(World.query(terrainBlockQuery))
      expect(chunks.length).toBe(1)
      expect(blocks.length).toBe(1)

      const renderQueue = yield* $(Ref.get(renderQueueRef))
      expect(renderQueue.length).toBe(1)
      expect(renderQueue[0]).toEqual({
        type: 'UpsertChunk',
        chunkX: 0,
        chunkZ: 0,
        mesh: chunkData.mesh,
      })
    }).pipe(Effect.provide(provideTestLayer())))
})