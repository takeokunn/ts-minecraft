import { describe, it, expect, vi, assert } from '@effect/vitest'
import { Effect, Layer, Queue, Scope } from 'effect'
import * as fc from 'effect/FastCheck'
import { worldUpdateSystem } from '../world-update'
import { ComputationWorker, PlacedBlock, Renderer, RenderCommand, World } from '@/runtime/services'
import { Position } from '@/domain/components'
import { Archetype } from '@/domain/archetypes'
import { BLOCK_COLLIDER } from '@/domain/world-constants'
import { arbitraryBlockType } from '@test/arbitraries'
import { OutgoingMessage } from '@/workers/messages'

const arbitraryPlacedBlock = fc.record({
  position: fc.tuple(fc.float(), fc.float(), fc.float()),
  blockType: arbitraryBlockType,
})

const arbitraryMesh = fc.record({
  positions: fc.float32Array(),
  normals: fc.float32Array(),
  uvs: fc.float32Array(),
  indices: fc.uint32Array(),
})

const arbitraryChunkGeneratedMessage = fc.record({
  type: fc.constant('chunkGenerated' as const),
  blocks: fc.array(arbitraryPlacedBlock),
  mesh: arbitraryMesh,
  chunkX: fc.integer(),
  chunkZ: fc.integer(),
})

describe('worldUpdateSystem', () => {
  it.effect('should adhere to world update properties', () =>
    Effect.gen(function* ($) {
      const message = yield* $(Effect.promise(() => fc.sample(arbitraryChunkGeneratedMessage, 1)[0]))

      const addArchetypeSpy = vi.fn(() => Effect.succeed(undefined as any))
      const offerSpy = vi.fn(() => Effect.succeed(true))

      const mockWorld: Partial<World> = {
        addArchetype: addArchetypeSpy,
      }
      const mockRenderer: Partial<Renderer> = {
        renderQueue: {
          offer: offerSpy,
        } as unknown as Queue.Queue<RenderCommand>,
      }

      let messageHandler: (message: OutgoingMessage) => Effect.Effect<void, never, Scope.Scope>
      const mockComputationWorker: Partial<ComputationWorker> = {
        onMessage: (handler) => {
          messageHandler = handler
          return Effect.void
        },
      }

      const testLayer = Layer.succeed(World, mockWorld as World).pipe(
        Layer.provide(Layer.succeed(Renderer, mockRenderer as Renderer)),
        Layer.provide(Layer.succeed(ComputationWorker, mockComputationWorker as ComputationWorker)),
      )

      yield* $(worldUpdateSystem.pipe(Effect.provide(testLayer)))
      yield* $(messageHandler!(message))

      assert.strictEqual(addArchetypeSpy.mock.calls.length, message.blocks.length)
      message.blocks.forEach((block, i) => {
        const expectedArchetype: Archetype = {
          position: new Position({
            x: block.position[0],
            y: block.position[1],
            z: block.position[2],
          }),
          renderable: { geometry: 'box', blockType: block.blockType },
          collider: BLOCK_COLLIDER,
          terrainBlock: {},
        }
        expect(addArchetypeSpy.mock.calls[i][0]).toEqual(expectedArchetype)
      })

      if (message.mesh.indices.length > 0) {
        assert.strictEqual(offerSpy.mock.calls.length, 1)
        expect(offerSpy.mock.calls[0][0]).toEqual({
          type: 'ADD_CHUNK',
          chunkX: message.chunkX,
          chunkZ: message.chunkZ,
          positions: message.mesh.positions,
          normals: message.mesh.normals,
          uvs: message.mesh.uvs,
          indices: message.mesh.indices,
        })
      } else {
        assert.strictEqual(offerSpy.mock.calls.length, 0)
      }
    }).pipe(Effect.scoped))
})