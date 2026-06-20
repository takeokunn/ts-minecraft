import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { Effect, Option } from 'effect'
import { StorageService, WorldMetadata } from '@ts-minecraft/world'
import { SlotIndex, WorldId } from '@ts-minecraft/core'
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

    it.effect('should round-trip a chunk fluid array alongside blocks (water/lava persistence)', () => {
      // Every other chunk test omits the fluid arg, so the fluid half of
      // ChunkStorageValue — how water/lava survives a reload — went unverified.
      // Use distinct block/fluid bytes so a swapped or dropped field is caught.
      const { TestLayer } = makeInMemoryStorageService()
      const blocks = new Uint8Array([1, 2, 3, 255, 0, 128])
      const fluid = new Uint8Array([7, 0, 9, 0, 200, 4])
      return Effect.gen(function* () {
        const storage = yield* StorageService
        yield* storage.saveChunk(testWorldId, testCoord, chunkStorageValue(blocks, fluid))
        const loaded = Option.getOrThrow(yield* storage.loadChunk(testWorldId, testCoord))
        expect(loaded.blocks).toEqual(blocks)
        expect(loaded.fluid).toEqual(fluid)
      }).pipe(Effect.provide(TestLayer))
    })

    it.effect('should round-trip a chunk with no fluid array (fluid stays undefined)', () => {
      // The fluid field is `Uint8Array | undefined`; a chunk saved without fluid
      // must load back with fluid === undefined, not an empty array or null.
      const { TestLayer } = makeInMemoryStorageService()
      const blocks = new Uint8Array([4, 5, 6])
      return Effect.gen(function* () {
        const storage = yield* StorageService
        yield* storage.saveChunk(testWorldId, testCoord, chunkStorageValue(blocks))
        const loaded = Option.getOrThrow(yield* storage.loadChunk(testWorldId, testCoord))
        expect(loaded.blocks).toEqual(blocks)
        expect(loaded.fluid).toBeUndefined()
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
        displayName: 'My Saved World',
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
        expect(loaded.displayName).toBe('My Saved World')
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
          hunger: { foodLevel: 20, saturation: 5 },
          totalXP: 0,
          equipment: {},
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
        // A mid-smelt furnace must resume exactly where it left off after reload:
        // the remaining fields (fuel, the still-empty output, the active recipe,
        // and the accumulated progress) all have to survive the round-trip, not
        // just position + input — otherwise a saved smelt silently resets.
        expect(loaded.furnaceStates?.[0]?.fuel).toEqual(Option.some({ itemType: 'COAL', count: 1 }))
        expect(loaded.furnaceStates?.[0]?.output).toEqual(Option.none())
        expect(loaded.furnaceStates?.[0]?.activeRecipeId).toEqual(Option.some('raw-iron-to-iron-ingot'))
        expect(loaded.furnaceStates?.[0]?.progressSecs).toBe(0.5)
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

    it.effect('deleteWorld spares another world whose id shares a string prefix (no over-deletion)', () => {
      // Chunk keys are `${worldId}:${x}:${z}` and deleteWorld scans by the
      // `${worldId}:` prefix. 'world' is a string prefix of 'world-2', so without
      // the TRAILING COLON the scan ('world-2:0:0'.startsWith('world')) would also
      // wipe 'world-2's chunks. The colon ('world-2:0:0'.startsWith('world:') ===
      // false) is what makes the delete target exactly one world.
      const { TestLayer } = makeInMemoryStorageService()
      const data = new Uint8Array([42])
      const coord = { x: 0, z: 0 }
      return Effect.gen(function* () {
        const storage = yield* StorageService
        yield* storage.saveChunk('world' as WorldId, coord, chunkStorageValue(data))
        yield* storage.saveChunk('world-2' as WorldId, coord, chunkStorageValue(data))
        yield* storage.deleteWorld('world' as WorldId)
        // Target world's chunk is gone...
        expect(yield* storage.loadChunk('world' as WorldId, coord)).toStrictEqual(Option.none())
        // ...the prefix-neighbour's chunk is untouched.
        expect(Option.isSome(yield* storage.loadChunk('world-2' as WorldId, coord))).toBe(true)
      }).pipe(Effect.provide(TestLayer))
    })

    it.effect('deleteWorld removes only the target world metadata, leaving other worlds', () => {
      const { TestLayer } = makeInMemoryStorageService()
      const now = new Date()
      const meta = (seed: number): WorldMetadata => ({
        seed, createdAt: now, lastPlayed: now,
        playerSpawn: { x: 0, y: 64, z: 0 }, gameMode: 'survival', saveVersion: 1,
      })
      return Effect.gen(function* () {
        const storage = yield* StorageService
        yield* storage.saveWorldMetadata('keep-me' as WorldId, meta(1))
        yield* storage.saveWorldMetadata('delete-me' as WorldId, meta(2))
        yield* storage.deleteWorld('delete-me' as WorldId)
        expect(yield* storage.loadWorldMetadata('delete-me' as WorldId)).toStrictEqual(Option.none())
        expect(Option.isSome(yield* storage.loadWorldMetadata('keep-me' as WorldId))).toBe(true)
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
