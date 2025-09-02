import { describe, it, expect } from 'vitest'
import { Effect, HashMap, Layer, Option, Ref } from 'effect'
import { calculateChunkUpdates, chunkLoadingSystem } from '../chunk-loading'
import { EntityId, toEntityId } from '@/domain/entity'
import * as World from '@/runtime/world-pure'
import { WorldContext } from '@/runtime/context'
import { OnCommand } from '@/runtime/services'
import { SystemCommand } from '@/domain/types'
import { createArchetype } from '@/domain/archetypes'
import { RENDER_DISTANCE } from '@/domain/world-constants'
import { Position } from '@/domain/components'
import { provideTestLayer } from 'test/utils'

const setupWorld = (playerPos: { x: number; y: number; z: number }, lastPlayerChunk: Option.Option<{ x: number; z: number }>, loadedChunks: HashMap.HashMap<string, EntityId>) =>
  Effect.gen(function* ($) {
    const { world } = yield* $(WorldContext)
    const playerArchetype = createArchetype({
      type: 'player',
      pos: new Position(playerPos),
    })
    yield* $(World.addArchetype(playerArchetype))
    yield* $(
      Ref.update(world, (ws) => ({
        ...ws,
        globalState: {
          ...ws.globalState,
          chunkLoading: {
            lastPlayerChunk,
            loadedChunks,
          },
        },
      })),
    )
  })

describe('chunkLoadingSystem', () => {
  describe('calculateChunkUpdates', () => {
    it('should identify chunks to load when none are loaded', () => {
      const currentPlayerChunk = { x: 0, z: 0 }
      const loadedChunks = HashMap.empty<string, EntityId>()
      const { toLoad, toUnload } = calculateChunkUpdates(currentPlayerChunk, loadedChunks, 1)

      expect(toUnload).toEqual([])
      expect(toLoad.length).toBe(9) // 3x3 grid
      expect(toLoad.find((c) => c.x === 0 && c.z === 0)).toEqual({ x: 0, z: 0 })
      expect(toLoad.find((c) => c.x === 1 && c.z === 1)).toEqual({ x: 1, z: 1 })
      expect(toLoad.find((c) => c.x === -1 && c.z === -1)).toEqual({ x: -1, z: -1 })
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

      expect(toUnload.length).toBe(3)
      expect(toLoad.length).toBe(3)
      expect(toLoad.find((c) => c.x === 2 && c.z === -1)).toBeDefined()
      expect(toLoad.find((c) => c.x === 2 && c.z === 0)).toBeDefined()
      expect(toLoad.find((c) => c.x === 2 && c.z === 1)).toBeDefined()
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
    it('should do nothing if the player has not moved to a new chunk', () =>
      Effect.gen(function* ($) {
        const commandRef = yield* $(Ref.make<SystemCommand[]>([]))

        yield* $(setupWorld({ x: 5, y: 0, z: 5 }, Option.some({ x: 0, z: 0 }), HashMap.empty()))
        yield* $(chunkLoadingSystem)

        const commands = yield* $(Ref.get(commandRef))
        expect(commands).toEqual([])
      }).pipe(Effect.provide(provideTestLayer().pipe(Layer.provide(Layer.succeed(OnCommand, (cmd) => Ref.update(commandRef, (cmds) => [...cmds, cmd])))))))

    it('should issue commands and remove entities when the player moves to a new chunk', () =>
      Effect.gen(function* ($) {
        const unloadedEntityId = toEntityId(999)
        const initialLoadedChunks = HashMap.empty<string, EntityId>().pipe(HashMap.set('99,99', unloadedEntityId))
        const commandRef = yield* $(Ref.make<SystemCommand[]>([]))

        yield* $(setupWorld({ x: 5, y: 0, z: 5 }, Option.none(), initialLoadedChunks))
        yield* $(chunkLoadingSystem)

        const commands = yield* $(Ref.get(commandRef))
        const expectedChunksToLoad = (2 * RENDER_DISTANCE + 1) ** 2
        expect(commands.length).toBe(expectedChunksToLoad)
        expect(commands.find((c) => c.type === 'GenerateChunk' && c.chunkX === 0 && c.chunkZ === 0)).toBeDefined()

        const entityExists = yield* $(World.getComponentOption(unloadedEntityId, 'position'))
        expect(Option.isNone(entityExists)).toBe(true)
      }).pipe(Effect.provide(provideTestLayer().pipe(Layer.provide(Layer.succeed(OnCommand, (cmd) => Ref.update(commandRef, (cmds) => [...cmds, cmd])))))))

    it('should do nothing if no player exists', () =>
      Effect.gen(function* ($) {
        const commandRef = yield* $(Ref.make<SystemCommand[]>([]))

        yield* $(chunkLoadingSystem)

        const commands = yield* $(Ref.get(commandRef))
        expect(commands).toEqual([])
      }).pipe(Effect.provide(provideTestLayer().pipe(Layer.provide(Layer.succeed(OnCommand, (cmd) => Ref.update(commandRef, (cmds) => [...cmds, cmd])))))))
  })
})
