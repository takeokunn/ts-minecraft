import { describe, it, expect, vi, beforeEach } from '@effect/vitest'
import { Effect, Layer, Queue } from 'effect'
import { worldUpdateSystem } from '../world-update'
import { ComputationWorker, Renderer, World } from '@/runtime/services'
import { Position } from '@/domain/components'
import { Float } from '@/domain/common'

const mockWorld: Partial<World> = {
  addArchetype: vi.fn(),
}

const mockRenderer: Partial<Renderer> = {
  renderQueue: {
    offer: vi.fn(),
  } as unknown as Queue.Queue<any>,
}

const mockComputationWorker: Partial<ComputationWorker> = {
  onMessage: vi.fn(),
}

const worldLayer = Layer.succeed(World, mockWorld as World)
const rendererLayer = Layer.succeed(Renderer, mockRenderer as Renderer)
const computationWorkerLayer = Layer.succeed(ComputationWorker, mockComputationWorker as ComputationWorker)
const testLayer = worldLayer.pipe(Layer.provide(rendererLayer)).pipe(Layer.provide(computationWorkerLayer))

describe('worldUpdateSystem', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it.effect('should handle chunkGenerated message', () =>
    Effect.gen(function* ($) {
      const message = {
        type: 'chunkGenerated',
        blocks: [
          {
            position: [0, 0, 0],
            blockType: 'grass',
          },
        ],
        mesh: {
          positions: new Float32Array([0, 0, 0]),
          normals: new Float32Array([0, 1, 0]),
          uvs: new Float32Array([0, 0]),
          indices: new Uint32Array([0, 1, 2]),
        },
        chunkX: 0,
        chunkZ: 0,
      }

      vi.spyOn(mockComputationWorker, 'onMessage').mockImplementation((callback) => callback(message))
      vi.spyOn(mockWorld, 'addArchetype').mockReturnValue(Effect.succeed(undefined as any))
      vi.spyOn(mockRenderer.renderQueue, 'offer').mockReturnValue(Effect.succeed(true))

      yield* $(worldUpdateSystem)

      expect(mockWorld.addArchetype).toHaveBeenCalledWith({
        type: 'block',
        pos: new Position({
          x: Float(0),
          y: Float(0),
          z: Float(0),
        }),
        blockType: 'grass',
      })
      expect(mockRenderer.renderQueue.offer).toHaveBeenCalledWith({
        type: 'ADD_CHUNK',
        chunkX: 0,
        chunkZ: 0,
        positions: message.mesh.positions,
        normals: message.mesh.normals,
        uvs: message.mesh.uvs,
        indices: message.mesh.indices,
      })
    }).pipe(Effect.provide(testLayer)))
})
