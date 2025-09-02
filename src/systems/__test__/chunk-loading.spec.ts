import { Effect, Layer, Option, HashMap, Ref, Record, HashSet } from 'effect'
import { describe, it, expect, vi } from 'vitest'
import { createArchetype } from '@/domain/archetypes'
import { OnCommand } from '@/runtime/services'
import { World, WorldLive, WorldState } from '@/runtime/world'
import { chunkLoadingSystem, calculateChunkUpdates } from '../chunk-loading'
import { RENDER_DISTANCE } from '@/domain/world-constants'
import { EntityId } from '@/domain/entity'
import { playerQuery } from '@/domain/queries'

const setupWorld = (position: { x: number; y: number; z: number }) =>
  Effect.gen(function* (_) {
    const world = yield* _(World)
    const playerArchetype = createArchetype({
      type: 'player',
      pos: position,
    })
    const playerId = yield* _(world.addArchetype(playerArchetype))
    return { playerId }
  })

describe('chunkLoadingSystem', () => {
  describe('calculateChunkUpdates', () => {
    it('should calculate chunks to load and unload', () => {
      const currentPlayerChunk = { x: 0, z: 0 }
      const loadedChunks = HashMap.empty<string, EntityId>()
      const { toLoad, toUnload } = calculateChunkUpdates(currentPlayerChunk, loadedChunks, RENDER_DISTANCE)

      expect(toUnload).toEqual([])
      expect(toLoad.length).toEqual((RENDER_DISTANCE * 2 + 1) ** 2)
    })

    it('should calculate chunks to unload', () => {
      const currentPlayerChunk = { x: 10, z: 10 }
      const loadedChunks = HashMap.make(['0,0', 1 as EntityId])
      const { toLoad, toUnload } = calculateChunkUpdates(currentPlayerChunk, loadedChunks, 1)

      expect(toUnload).toEqual([1 as EntityId])
      expect(toLoad.length).toEqual(9)
    })
  })

  describe('chunkLoadingSystem', () => {
    it('should issue GenerateChunk commands for new chunks', async () => {
      const onCommand = vi.fn(() => Effect.void)
      const MockOnCommand = Layer.succeed(OnCommand, onCommand)

      const program = Effect.gen(function* (_) {
        yield* _(setupWorld({ x: 0, y: 0, z: 0 }))
        yield* _(chunkLoadingSystem)
      })

      await Effect.runPromise(Effect.provide(program, Layer.merge(WorldLive, MockOnCommand)))

      expect(onCommand).toHaveBeenCalled()
      const numberOfChunks = (RENDER_DISTANCE * 2 + 1) ** 2
      expect(onCommand).toHaveBeenCalledTimes(numberOfChunks)
      expect(onCommand).toHaveBeenCalledWith(expect.objectContaining({ type: 'GenerateChunk' }))
    })

    it('should not issue commands if player has not moved across a chunk boundary', async () => {
      const onCommand = vi.fn(() => Effect.void)
      const MockOnCommand = Layer.succeed(OnCommand, onCommand)

      const program = Effect.gen(function* (_) {
        const world = yield* _(World)
        yield* _(setupWorld({ x: 0, y: 0, z: 0 }))
        yield* _(chunkLoadingSystem) // First run to set initial chunk
        onCommand.mockClear()

        // Move player slightly, but within the same chunk
        const players = yield* _(world.query(playerQuery))
        const player = players[0]!
        yield* _(world.updateComponent(player.entityId, 'position', { x: 1, y: 0, z: 1 }))

        yield* _(chunkLoadingSystem) // Second run
      })

      await Effect.runPromise(Effect.provide(program, Layer.merge(WorldLive, MockOnCommand)))

      expect(onCommand).not.toHaveBeenCalled()
    })

    it('should unload chunks that are out of range', async () => {
      const onCommand = vi.fn(() => Effect.void)
      const MockOnCommand = Layer.succeed(OnCommand, onCommand)
      const chunkToUnloadId = 1 as EntityId

      const program = Effect.gen(function* (_) {
        const world = yield* _(World)
        const state: WorldState = {
          nextEntityId: 1,
          entities: new Map(),
          archetypes: new Map(),
          components: {
            chunk: new Map(),
            position: new Map(),
            player: new Map(),
            velocity: new Map(),
            inputState: new Map(),
            cameraState: new Map(),
            hotbar: new Map(),
            target: new Map(),
            gravity: new Map(),
            collider: new Map(),
            renderable: new Map(),
            instancedMeshRenderable: new Map(),
            terrainBlock: new Map(),
            targetBlock: new Map(),
            camera: new Map(),
            chunkLoaderState: new Map(),
          },
          globalState: {
            scene: 'InGame',
            seeds: { world: 1, biome: 1, trees: 1 },
            amplitude: 1,
            chunkLoading: {
              lastPlayerChunk: Option.some({ x: -100, z: -100 }),
              loadedChunks: HashMap.make(['-100,-100', chunkToUnloadId]),
            },
            editedBlocks: {
              placed: Record.empty(),
              destroyed: HashSet.empty(),
            },
          },
        }
        yield* _(Ref.set(world.state, state))

        yield* _(setupWorld({ x: 0, y: 0, z: 0 }))
        yield* _(chunkLoadingSystem)

        const chunkExists = yield* _(world.getComponent(chunkToUnloadId, 'chunk'))
        expect(Option.isNone(chunkExists)).toBe(true)
      })

      await Effect.runPromise(Effect.provide(program, Layer.merge(WorldLive, MockOnCommand)))
    })
  })
})