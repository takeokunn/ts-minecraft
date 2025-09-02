import { describe, it, expect, vi } from 'vitest'
import { Effect, HashMap, Layer, Option } from 'effect'
import { calculateChunkUpdates, chunkLoadingSystem } from '../chunk-loading'
import { EntityId, toEntityId } from '@/domain/entity'
import { World, WorldLive } from '@/runtime/world'
import { OnCommand } from '@/runtime/services'
import { createArchetype } from '@/domain/archetypes'
import { RENDER_DISTANCE } from '@/domain/world-constants'
import { Position } from '@/domain/components'

const setupWorld = (
  playerPos: { x: number; y: number; z: number },
  lastPlayerChunk: Option.Option<{ x: number; z: number }>,
  loadedChunks: HashMap.HashMap<string, EntityId>,
) =>
  Effect.gen(function* (_) {
    const world = yield* _(World)
    const playerArchetype = createArchetype({
      type: 'player',
      pos: new Position(playerPos),
    })
    yield* _(world.addArchetype(playerArchetype))
    yield* _(
      world.modify((ws) => [
        null,
        {
          ...ws,
          globalState: {
            ...ws.globalState,
            chunkLoading: {
              lastPlayerChunk,
              loadedChunks,
            },
          },
        },
      ]),
    )
  })

describe('chunkLoadingSystem', () => {
  describe('calculateChunkUpdates', () => {
    it('should identify chunks to load when none are loaded', () => {
      const currentPlayerChunk = { x: 0, z: 0 }
      const loadedChunks = HashMap.empty<string, EntityId>()
      const { toLoad, toUnload } = calculateChunkUpdates(currentPlayerChunk, loadedChunks, 1)

      expect(toUnload).toEqual([])
      expect(toLoad).toHaveLength(9) // 3x3 grid
      expect(toLoad).toContainEqual({ x: 0, z: 0 })
      expect(toLoad).toContainEqual({ x: 1, z: 1 })
      expect(toLoad).toContainEqual({ x: -1, z: -1 })
    })

    it('should identify chunks to unload when player moves', () => {
      let loadedChunks = HashMap.empty<string, EntityId>()
      for (let x = -1; x <= 1; x++) {
        for (let z = -1; z <= 1; z++) {
          loadedChunks = HashMap.set(loadedChunks, `${x},${z}`, toEntityId((x + 1) * 10 + (z + 1)))
        }
      }

      const newPlayerChunk = { x: 1, z: 0 }
      const { toLoad, toUnload } = calculateChunkUpdates(newPlayerChunk, loadedChunks, 1)

      expect(toUnload).toHaveLength(3)
      expect(toLoad).toHaveLength(3)
      expect(toLoad).toContainEqual({ x: 2, z: -1 })
      expect(toLoad).toContainEqual({ x: 2, z: 0 })
      expect(toLoad).toContainEqual({ x: 2, z: 1 })
    })

    it('should do nothing if the required chunks are already loaded', () => {
      const currentPlayerChunk = { x: 0, z: 0 }
      let loadedChunks = HashMap.empty<string, EntityId>()
      for (let x = -RENDER_DISTANCE; x <= RENDER_DISTANCE; x++) {
        for (let z = -RENDER_DISTANCE; z <= RENDER_DISTANCE; z++) {
          loadedChunks = HashMap.set(loadedChunks, `${x},${z}`, toEntityId(x * 100 + z))
        }
      }

      const { toLoad, toUnload } = calculateChunkUpdates(currentPlayerChunk, loadedChunks, RENDER_DISTANCE)
      expect(toLoad).toEqual([])
      expect(toUnload).toEqual([])
    })
  })

  describe('system logic', () => {
    it('should do nothing if the player has not moved to a new chunk', async () => {
      const onCommand = vi.fn(() => Effect.void)
      const OnCommandLive = Layer.succeed(OnCommand, onCommand)
      const program = Effect.gen(function* (_) {
        yield* _(setupWorld({ x: 5, y: 0, z: 5 }, Option.some({ x: 0, z: 0 }), HashMap.empty()))
        yield* _(chunkLoadingSystem)
      })

      // @ts-expect-error R a is not assignable to never
      await Effect.runPromise(Effect.provide(program, Layer.merge(WorldLive, OnCommandLive)))

      expect(onCommand).not.toHaveBeenCalled()
    })

    it('should issue commands and remove entities when the player moves to a new chunk', async () => {
      const unloadedEntityId = toEntityId(999)
      const initialLoadedChunks = HashMap.empty<string, EntityId>().pipe(HashMap.set('99,99', unloadedEntityId))
      const onCommand = vi.fn(() => Effect.void)
      const OnCommandLive = Layer.succeed(OnCommand, onCommand)

      const program = Effect.gen(function* (_) {
        const world = yield* _(World)
        yield* _(setupWorld({ x: 5, y: 0, z: 5 }, Option.none(), initialLoadedChunks))
        const removeEntitySpy = vi.spyOn(world, 'removeEntity')

        yield* _(chunkLoadingSystem)

        const expectedChunksToLoad = (2 * RENDER_DISTANCE + 1) ** 2
        expect(onCommand).toHaveBeenCalledTimes(expectedChunksToLoad)
        expect(onCommand).toHaveBeenCalledWith({
          type: 'GenerateChunk',
          chunkX: 0,
          chunkZ: 0,
        })
        expect(removeEntitySpy).toHaveBeenCalledTimes(1)
        expect(removeEntitySpy).toHaveBeenCalledWith(unloadedEntityId)
      })

      // @ts-expect-error R a is not assignable to never
      await Effect.runPromise(Effect.provide(program, Layer.merge(WorldLive, OnCommandLive)))
    })

    it('should do nothing if no player exists', async () => {
      const onCommand = vi.fn(() => Effect.void)
      const OnCommandLive = Layer.succeed(OnCommand, onCommand)
      const program = Effect.gen(function* (_) {
        const world = yield* _(World)
        const removeEntitySpy = vi.spyOn(world, 'removeEntity')
        yield* _(chunkLoadingSystem)
        expect(onCommand).not.toHaveBeenCalled()
        expect(removeEntitySpy).not.toHaveBeenCalled()
      })

      // @ts-expect-error R a is not assignable to never
      await Effect.runPromise(Effect.provide(program, Layer.merge(WorldLive, OnCommandLive)))
    })

    it('should do nothing if player position is undefined', async () => {
      const onCommand = vi.fn(() => Effect.void)
      const OnCommandLive = Layer.succeed(OnCommand, onCommand)
      const program = Effect.gen(function* (_) {
        const world = yield* _(World)
        const playerArchetype = createArchetype({
          type: 'player',
          pos: { x: 1, y: 1, z: 1 },
        })
        const playerId = yield* _(world.addArchetype(playerArchetype))

        // Manually set an invalid position
        yield* _(
          world.update((w) => {
            const newPositionMap = new Map(w.components.position)
            const playerPos = newPositionMap.get(playerId)
            if (playerPos) {
              // @ts-expect-error - Intentionally creating an invalid position for testing
              newPositionMap.set(playerId, { ...playerPos, x: undefined })
            }
            return { ...w, components: { ...w.components, position: newPositionMap } }
          }),
        )

        const removeEntitySpy = vi.spyOn(world, 'removeEntity')
        yield* _(chunkLoadingSystem)
        expect(onCommand).not.toHaveBeenCalled()
        expect(removeEntitySpy).not.toHaveBeenCalled()
      })

      // @ts-expect-error R a is not assignable to never
      await Effect.runPromise(Effect.provide(program, Layer.merge(WorldLive, OnCommandLive)))
    })
  })
})