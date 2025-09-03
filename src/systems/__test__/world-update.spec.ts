import { describe, it, expect, vi } from '@effect/vitest'
import { Effect, Layer, Queue } from 'effect'
import { worldUpdateSystem } from '../world-update'
import { ComputationWorker, PlacedBlock, Renderer, RenderCommand, World } from '@/runtime/services'
import { Position } from '@/domain/components'
import { Archetype } from '@/domain/archetypes'
import { BLOCK_COLLIDER } from '@/domain/world-constants'

describe('worldUpdateSystem', () => {
  it.effect('should handle chunkGenerated message', () =>
    Effect.gen(function* ($) {
      const blocks: ReadonlyArray<PlacedBlock> = [
        {
          position: [0, 0, 0],
          blockType: 'grass',
        },
      ]
      const message = {
        type: 'chunkGenerated' as const,
        blocks,
        mesh: {
          positions: new Float32Array([0, 0, 0]),
          normals: new Float32Array([0, 1, 0]),
          uvs: new Float32Array([0, 0]),
          indices: new Uint32Array([0, 1, 2]),
        },
        chunkX: 0,
        chunkZ: 0,
      }

      const addArchetypeMock = vi.fn(() => Effect.succeed(undefined as any))
      const offerMock = vi.fn(() => Effect.succeed(true))

      const mockWorld: Partial<World> = {
        addArchetype: addArchetypeMock,
      }

      const mockRenderer: Partial<Renderer> = {
        renderQueue: {
          offer: offerMock,
        } as unknown as Queue.Queue<RenderCommand>,
      }

      const mockComputationWorker: Partial<ComputationWorker> = {
        onMessage: (handler) => handler(message),
      }

      const testLayer = Layer.succeed(World, mockWorld as World).pipe(
        Layer.provide(Layer.succeed(Renderer, mockRenderer as Renderer)),
        Layer.provide(Layer.succeed(ComputationWorker, mockComputationWorker as ComputationWorker)),
      )

      yield* $(worldUpdateSystem.pipe(Effect.provide(testLayer)))

      const expectedArchetype: Archetype = {
        position: new Position({ x: 0, y: 0, z: 0 }),
        renderable: { geometry: 'box', blockType: 'grass' },
        collider: BLOCK_COLLIDER,
        terrainBlock: {},
      }

      expect(addArchetypeMock).toHaveBeenCalledWith(expectedArchetype)

      expect(offerMock).toHaveBeenCalledWith({
        type: 'ADD_CHUNK',
        chunkX: 0,
        chunkZ: 0,
        positions: message.mesh.positions,
        normals: message.mesh.normals,
        uvs: message.mesh.uvs,
        indices: message.mesh.indices,
      })
    }))
})
