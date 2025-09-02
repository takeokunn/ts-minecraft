import { describe, it, expect, vi } from 'vitest'
import { Effect, Layer } from 'effect'
import { worldUpdateSystem } from '../world-update'
import { World, WorldLive } from '@/runtime/world'
import { ChunkDataQueueService, RenderQueueService } from '@/runtime/services'
import { PlacedBlock } from '@/domain/block'
import { ChunkGenerationResult, RenderCommand } from '@/domain/types'

const setup = (chunkResult: ChunkGenerationResult | null) => {
  const chunkQueue: ChunkGenerationResult[] = chunkResult ? [chunkResult] : []
  const renderQueue: RenderCommand[] = []

  const ChunkDataQueueLive = Layer.succeed(ChunkDataQueueService, chunkQueue)
  const RenderQueueLive = Layer.succeed(RenderQueueService, renderQueue)

  const TestLayer = Layer.mergeAll(WorldLive, ChunkDataQueueLive, RenderQueueLive)
  return { TestLayer, renderQueue, chunkQueue }
}

describe('worldUpdateSystem', () => {
  it('should do nothing if the chunk data queue is empty', async () => {
    const { TestLayer, renderQueue } = setup(null)
    const program = Effect.gen(function* (_) {
      const world = yield* _(World)
      const addArchetypeSpy = vi.spyOn(world, 'addArchetype')
      yield* _(worldUpdateSystem)
      expect(addArchetypeSpy).not.toHaveBeenCalled()
      expect(renderQueue.length).toBe(0)
    })

    await Effect.runPromise(program.pipe(Effect.provide(TestLayer)))
  })

  it('should update world and render queue when a chunk is processed', async () => {
    const blocks: PlacedBlock[] = [{ position: { x: 0, y: 64, z: 0 }, blockType: 'stone' }]
    const mesh = {
      positions: new Float32Array([0, 0, 0]),
      normals: new Float32Array([0, 1, 0]),
      uvs: new Float32Array([0, 0]),
      indices: new Uint32Array([0, 1, 2]),
    }
    const chunkResult: ChunkGenerationResult = { blocks, mesh, chunkX: 0, chunkZ: 0 }
    const { TestLayer, renderQueue } = setup(chunkResult)

    const program = Effect.gen(function* (_) {
      const world = yield* _(World)
      const addArchetypeSpy = vi.spyOn(world, 'addArchetype')
      yield* _(worldUpdateSystem)
      // Chunk archetype + block archetypes
      expect(addArchetypeSpy).toHaveBeenCalledTimes(blocks.length + 1)
      expect(renderQueue.length).toBe(1)
      expect(renderQueue[0]).toEqual({
        type: 'UpsertChunk',
        chunkX: 0,
        chunkZ: 0,
        mesh,
      })
    })

    await Effect.runPromise(program.pipe(Effect.provide(TestLayer)))
  })

  it('should not push to render queue if mesh is empty', async () => {
    const blocks: PlacedBlock[] = []
    const mesh = {
      positions: new Float32Array(),
      normals: new Float32Array(),
      uvs: new Float32Array(),
      indices: new Uint32Array(),
    }
    const chunkResult: ChunkGenerationResult = { blocks, mesh, chunkX: 0, chunkZ: 0 }
    const { TestLayer, renderQueue } = setup(chunkResult)

    const program = Effect.gen(function* (_) {
      const world = yield* _(World)
      const addArchetypeSpy = vi.spyOn(world, 'addArchetype')
      yield* _(worldUpdateSystem)
      expect(addArchetypeSpy).toHaveBeenCalledTimes(1) // Just the chunk archetype
      expect(renderQueue.length).toBe(0)
    })

    await Effect.runPromise(program.pipe(Effect.provide(TestLayer)))
  })
})
