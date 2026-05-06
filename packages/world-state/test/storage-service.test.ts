import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { Effect, Option } from 'effect'
import { StorageService, WorldMetadata } from '@ts-minecraft/world-state'
import { SlotIndex, WorldId } from '@ts-minecraft/kernel'
import { testWorldId, anotherWorldId, testCoord, chunkStorageBlocks, chunkStorageValue, makeInMemoryStorageService } from './storage-service-test-utils'

describe('infrastructure/storage/storage-service', () => {
  describe('StorageService contract (in-memory)', () => {
    it.effect('should round-trip saveChunk and loadChunk preserving Uint8Array bytes exactly', () => {
      const { TestLayer } = makeInMemoryStorageService()
      const data = new Uint8Array([1, 2, 3, 255, 0, 128])
      return Effect.gen(function* () {
        const storage = yield* StorageService
        yield* storage.saveChunk(testWorldId, testCoord, chunkStorageValue(data))
        expect(chunkStorageBlocks(Option.getOrThrow(yield* storage.loadChunk(testWorldId, testCoord)))).toEqual(data)
      }).pipe(Effect.provide(TestLayer))
    })

    it.effect('should return Option.none() for a chunk that has not been saved', () => {
      const { TestLayer } = makeInMemoryStorageService()
      const missingCoord = { x: 999, z: 999 }
      return Effect.gen(function* () {
        const storage = yield* StorageService
        expect(yield* storage.loadChunk(testWorldId, missingCoord)).toStrictEqual(Option.none())
      }).pipe(Effect.provide(TestLayer))
    })

    it.effect('should round-trip saveWorldMetadata and loadWorldMetadata', () => {
      const { TestLayer } = makeInMemoryStorageService()
      const now = new Date()
      const metadata: WorldMetadata = {
        seed: 42,
        createdAt: now,
        lastPlayed: now,
        playerSpawn: { x: 8, y: 64, z: 8 },
        gameMode: 'survival',
        saveVersion: 1,
      }
      return Effect.gen(function* () {
        const storage = yield* StorageService
        yield* storage.saveWorldMetadata(testWorldId, metadata)
        const loaded = Option.getOrThrow(yield* storage.loadWorldMetadata(testWorldId))
        expect(loaded.seed).toBe(42)
        expect(loaded.playerSpawn).toEqual({ x: 8, y: 64, z: 8 })
      }).pipe(Effect.provide(TestLayer))
    })

    it.effect('should round-trip optional persisted player state in world metadata', () => {
      const { TestLayer } = makeInMemoryStorageService()
      const now = new Date()
      const metadata: WorldMetadata = {
        seed: 42,
        createdAt: now,
        lastPlayed: now,
        playerSpawn: { x: 8, y: 64, z: 8 },
        playerState: {
          position: { x: 12, y: 70, z: -4 },
          health: 13,
          inventory: {
            slots: [
              Option.some({ slot: SlotIndex.make(0), itemType: 'WOOD', count: 3 }),
              Option.none(),
            ],
          },
          timeOfDay: 0.75,
        },
        furnaceStates: [
          {
            position: { x: 8, y: 64, z: 8 },
            input: Option.some({ itemType: 'RAW_IRON', count: 1 }),
            fuel: Option.some({ itemType: 'COAL', count: 1 }),
            output: Option.none(),
            activeRecipeId: Option.some('raw-iron-to-iron-ingot' as never),
            progressSecs: 0.5,
          },
        ],
        gameMode: 'survival',
        saveVersion: 1,
      }
      return Effect.gen(function* () {
        const storage = yield* StorageService
        yield* storage.saveWorldMetadata(testWorldId, metadata)
        const loaded = Option.getOrThrow(yield* storage.loadWorldMetadata(testWorldId))
        expect(loaded.playerState?.position).toEqual({ x: 12, y: 70, z: -4 })
        expect(loaded.playerState?.health).toBe(13)
        expect(loaded.playerState?.timeOfDay).toBe(0.75)
        expect(loaded.playerState?.inventory.slots[0]).toEqual(Option.some({ slot: SlotIndex.make(0), itemType: 'WOOD', count: 3 }))
        expect(loaded.furnaceStates?.[0]?.position).toEqual({ x: 8, y: 64, z: 8 })
        expect(loaded.furnaceStates?.[0]?.input).toEqual(Option.some({ itemType: 'RAW_IRON', count: 1 }))
      }).pipe(Effect.provide(TestLayer))
    })

    it.effect('should return Option.none() for metadata of non-existent worldId', () => {
      const { TestLayer } = makeInMemoryStorageService()
      return Effect.gen(function* () {
        const storage = yield* StorageService
        expect(yield* storage.loadWorldMetadata('nonexistent-world' as WorldId)).toStrictEqual(Option.none())
      }).pipe(Effect.provide(TestLayer))
    })

    it.effect('should delete all chunks with matching worldId prefix on deleteWorld', () => {
      const { TestLayer } = makeInMemoryStorageService()
      const coord1 = { x: 0, z: 0 }
      const coord2 = { x: 1, z: 0 }
      const coord3 = { x: 0, z: 1 }
      const data = new Uint8Array([42])
      return Effect.gen(function* () {
        const storage = yield* StorageService
        yield* storage.saveChunk(testWorldId, coord1, chunkStorageValue(data))
        yield* storage.saveChunk(testWorldId, coord2, chunkStorageValue(data))
        yield* storage.saveChunk(testWorldId, coord3, chunkStorageValue(data))
        yield* storage.deleteWorld(testWorldId)
        expect(yield* storage.loadChunk(testWorldId, coord1)).toStrictEqual(Option.none())
        expect(yield* storage.loadChunk(testWorldId, coord2)).toStrictEqual(Option.none())
        expect(yield* storage.loadChunk(testWorldId, coord3)).toStrictEqual(Option.none())
      }).pipe(Effect.provide(TestLayer))
    })

    it.effect('should delete metadata for the world on deleteWorld', () => {
      const { TestLayer } = makeInMemoryStorageService()
      const now = new Date()
      const metadata: WorldMetadata = {
        seed: 99,
        createdAt: now,
        lastPlayed: now,
        playerSpawn: { x: 0, y: 64, z: 0 },
        gameMode: 'survival',
        saveVersion: 1,
      }
      return Effect.gen(function* () {
        const storage = yield* StorageService
        yield* storage.saveWorldMetadata(testWorldId, metadata)
        yield* storage.deleteWorld(testWorldId)
        expect(yield* storage.loadWorldMetadata(testWorldId)).toStrictEqual(Option.none())
      }).pipe(Effect.provide(TestLayer))
    })

    it.effect('should treat initialize as idempotent — calling twice does not error', () => {
      const { TestLayer } = makeInMemoryStorageService()
      return Effect.gen(function* () {
        const storage = yield* StorageService
        yield* storage.initialize
        yield* storage.initialize
      }).pipe(Effect.provide(TestLayer))
    })

    it.effect('should keep multiple worlds coexisting without collision', () => {
      const { TestLayer } = makeInMemoryStorageService()
      const data1 = new Uint8Array([1])
      const data2 = new Uint8Array([2])
      return Effect.gen(function* () {
        const storage = yield* StorageService
        yield* storage.saveChunk(testWorldId, testCoord, chunkStorageValue(data1))
        yield* storage.saveChunk(anotherWorldId, testCoord, chunkStorageValue(data2))
        expect(chunkStorageBlocks(Option.getOrThrow(yield* storage.loadChunk(testWorldId, testCoord)))).toEqual(data1)
        expect(chunkStorageBlocks(Option.getOrThrow(yield* storage.loadChunk(anotherWorldId, testCoord)))).toEqual(data2)
      }).pipe(Effect.provide(TestLayer))
    })

    it.effect('should store different data for same coord under different worldIds (key collision isolation)', () => {
      const { TestLayer } = makeInMemoryStorageService()
      const coord = { x: 5, z: -3 }
      const dataA = new Uint8Array([10, 20, 30])
      const dataB = new Uint8Array([40, 50, 60])
      return Effect.gen(function* () {
        const storage = yield* StorageService
        yield* storage.saveChunk('world-a' as WorldId, coord, chunkStorageValue(dataA))
        yield* storage.saveChunk('world-b' as WorldId, coord, chunkStorageValue(dataB))
        const ra = yield* storage.loadChunk('world-a' as WorldId, coord)
        const rb = yield* storage.loadChunk('world-b' as WorldId, coord)
        expect(chunkStorageBlocks(Option.getOrThrow(ra))).toEqual(dataA)
        expect(chunkStorageBlocks(Option.getOrThrow(rb))).toEqual(dataB)
      }).pipe(Effect.provide(TestLayer))
    })

    it.effect('should overwrite chunk data on second save for same worldId + coord', () => {
      const { TestLayer } = makeInMemoryStorageService()
      const firstData = new Uint8Array([1, 1, 1])
      const secondData = new Uint8Array([9, 9, 9])
      return Effect.gen(function* () {
        const storage = yield* StorageService
        yield* storage.saveChunk(testWorldId, testCoord, chunkStorageValue(firstData))
        yield* storage.saveChunk(testWorldId, testCoord, chunkStorageValue(secondData))
        const result = yield* storage.loadChunk(testWorldId, testCoord)
        expect(chunkStorageBlocks(Option.getOrThrow(result))).toEqual(secondData)
      }).pipe(Effect.provide(TestLayer))
    })

    it.effect('should not delete chunks of another world when deleting one world', () => {
      const { TestLayer } = makeInMemoryStorageService()
      const data = new Uint8Array([7])
      return Effect.gen(function* () {
        const storage = yield* StorageService
        yield* storage.saveChunk(testWorldId, testCoord, chunkStorageValue(data))
        yield* storage.saveChunk(anotherWorldId, testCoord, chunkStorageValue(data))
        yield* storage.deleteWorld(testWorldId)
        expect(chunkStorageBlocks(Option.getOrThrow(yield* storage.loadChunk(anotherWorldId, testCoord)))).toEqual(data)
      }).pipe(Effect.provide(TestLayer))
    })

    it.effect('should overwrite metadata on second saveWorldMetadata', () => {
      const { TestLayer } = makeInMemoryStorageService()
      const now = new Date()
      const firstMeta: WorldMetadata = { seed: 1, createdAt: now, lastPlayed: now, playerSpawn: { x: 0, y: 64, z: 0 }, gameMode: 'survival', saveVersion: 1 }
      const secondMeta: WorldMetadata = { seed: 2, createdAt: now, lastPlayed: now, playerSpawn: { x: 8, y: 80, z: 8 }, gameMode: 'survival', saveVersion: 1 }
      return Effect.gen(function* () {
        const storage = yield* StorageService
        yield* storage.saveWorldMetadata(testWorldId, firstMeta)
        yield* storage.saveWorldMetadata(testWorldId, secondMeta)
        const result = yield* storage.loadWorldMetadata(testWorldId)
        const loaded = Option.getOrThrow(result)
        expect(loaded.seed).toBe(2)
        expect(loaded.playerSpawn).toEqual({ x: 8, y: 80, z: 8 })
      }).pipe(Effect.provide(TestLayer))
    })
  })

  // ---------------------------------------------------------------------------
  // StorageError TaggedError structure
  // ---------------------------------------------------------------------------

})
