import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { Array as Arr, Effect, Option, Schema } from 'effect'
import { StorageService, WorldMetadataSchema, WorldMetadata } from '@ts-minecraft/world-state'
import { WorldId } from '@ts-minecraft/kernel'
import type { ChunkCoord } from '@ts-minecraft/kernel'
import { testWorldId, anotherWorldId, testCoord, chunkStorageBlocks, chunkStorageValue, makeInMemoryStorageService } from './storage-service-test-utils'

// ---------------------------------------------------------------------------
// Additional contract tests — edge cases and error handling
// ---------------------------------------------------------------------------

describe('infrastructure/storage/storage-service-schema', () => {
  describe('StorageService contract (additional edge cases)', () => {
    it.effect('should handle saving and loading a large chunk (CHUNK_SIZE * CHUNK_SIZE * 256 bytes)', () => {
      const { TestLayer } = makeInMemoryStorageService()
      // Fill with a repeating 0..255 pattern to detect corruption
      const largeData = Uint8Array.from({ length: 16 * 16 * 256 }, (_, i) => i % 256)
      return Effect.gen(function* () {
        const storage = yield* StorageService
        yield* storage.saveChunk(testWorldId, testCoord, chunkStorageValue(largeData))
        const retrieved = Option.getOrThrow(yield* storage.loadChunk(testWorldId, testCoord))
        const retrievedBlocks = chunkStorageBlocks(retrieved)
        expect(retrievedBlocks.length).toBe(largeData.length)
        expect(retrievedBlocks).toEqual(largeData)
      }).pipe(Effect.provide(TestLayer))
    })

    it.effect('should handle empty Uint8Array as chunk data', () => {
      const { TestLayer } = makeInMemoryStorageService()
      const emptyData = new Uint8Array(0)
      return Effect.gen(function* () {
        const storage = yield* StorageService
        yield* storage.saveChunk(testWorldId, testCoord, chunkStorageValue(emptyData))
        expect(chunkStorageBlocks(Option.getOrThrow(yield* storage.loadChunk(testWorldId, testCoord))).length).toBe(0)
      }).pipe(Effect.provide(TestLayer))
    })

    it.effect('should handle negative chunk coordinates', () => {
      const { TestLayer } = makeInMemoryStorageService()
      const negativeCoord: ChunkCoord = { x: -5, z: -3 }
      const data = new Uint8Array([42, 43, 44])
      return Effect.gen(function* () {
        const storage = yield* StorageService
        yield* storage.saveChunk(testWorldId, negativeCoord, chunkStorageValue(data))
        expect(chunkStorageBlocks(Option.getOrThrow(yield* storage.loadChunk(testWorldId, negativeCoord)))).toEqual(data)
      }).pipe(Effect.provide(TestLayer))
    })

    it.effect('should correctly isolate chunks at nearby coordinates', () => {
      const { TestLayer } = makeInMemoryStorageService()
      const coord1: ChunkCoord = { x: 0, z: 0 }
      const coord2: ChunkCoord = { x: 0, z: 1 }
      const coord3: ChunkCoord = { x: 1, z: 0 }
      const data1 = new Uint8Array([1])
      const data2 = new Uint8Array([2])
      const data3 = new Uint8Array([3])
      return Effect.gen(function* () {
        const storage = yield* StorageService
        yield* storage.saveChunk(testWorldId, coord1, chunkStorageValue(data1))
        yield* storage.saveChunk(testWorldId, coord2, chunkStorageValue(data2))
        yield* storage.saveChunk(testWorldId, coord3, chunkStorageValue(data3))
        const r1 = yield* storage.loadChunk(testWorldId, coord1)
        const r2 = yield* storage.loadChunk(testWorldId, coord2)
        const r3 = yield* storage.loadChunk(testWorldId, coord3)
        expect(chunkStorageBlocks(Option.getOrThrow(r1))).toEqual(data1)
        expect(chunkStorageBlocks(Option.getOrThrow(r2))).toEqual(data2)
        expect(chunkStorageBlocks(Option.getOrThrow(r3))).toEqual(data3)
      }).pipe(Effect.provide(TestLayer))
    })

    it.effect('should deleteWorld for a world with no chunks (no error)', () => {
      const { TestLayer } = makeInMemoryStorageService()
      return Effect.gen(function* () {
        const storage = yield* StorageService
        // Delete a world that was never created
        yield* storage.deleteWorld('never-existed' as WorldId)
      }).pipe(Effect.provide(TestLayer))
    })

    it.effect('should preserve metadata of other worlds when deleting one world', () => {
      const { TestLayer } = makeInMemoryStorageService()
      const now = new Date()
      const metaA: WorldMetadata = {
        seed: 111,
        createdAt: now,
        lastPlayed: now,
        playerSpawn: { x: 0, y: 64, z: 0 },
        gameMode: 'survival',
        saveVersion: 1,
      }
      const metaB: WorldMetadata = {
        seed: 222,
        createdAt: now,
        lastPlayed: now,
        playerSpawn: { x: 10, y: 80, z: 10 },
        gameMode: 'survival',
        saveVersion: 1,
      }
      return Effect.gen(function* () {
        const storage = yield* StorageService
        yield* storage.saveWorldMetadata(testWorldId, metaA)
        yield* storage.saveWorldMetadata(anotherWorldId, metaB)
        yield* storage.deleteWorld(testWorldId)
        expect(yield* storage.loadWorldMetadata(testWorldId)).toStrictEqual(Option.none())
        expect(Option.getOrThrow(yield* storage.loadWorldMetadata(anotherWorldId)).seed).toBe(222)
      }).pipe(Effect.provide(TestLayer))
    })

    it.effect('should handle saving chunks across many different coordinates', () => {
      const { TestLayer } = makeInMemoryStorageService()
      const coordCount = 20
      return Effect.gen(function* () {
        const storage = yield* StorageService
        yield* Effect.forEach(Arr.makeBy(coordCount, i => i), i => {
          const coord: ChunkCoord = { x: i, z: i * 2 }
          return storage.saveChunk(testWorldId, coord, chunkStorageValue(new Uint8Array([i])))
        }, { concurrency: 1 })
        // Verify all can be loaded back
        yield* Effect.forEach(Arr.makeBy(coordCount, i => i), i => Effect.gen(function* () {
          const coord: ChunkCoord = { x: i, z: i * 2 }
          const loaded = Option.getOrThrow(yield* storage.loadChunk(testWorldId, coord))
          expect(chunkStorageBlocks(loaded)[0]).toBe(i)
        }), { concurrency: 1 })
      }).pipe(Effect.provide(TestLayer))
    })
  })

  // ---------------------------------------------------------------------------
  // B3: loadWorldMetadata schema validation
  // ---------------------------------------------------------------------------

  describe('loadWorldMetadata schema validation', () => {
    it.effect('returns Option.some with correct fields when valid metadata was saved', () => {
      const { TestLayer } = makeInMemoryStorageService()
      const now = new Date()
      const validMeta: WorldMetadata = {
        seed: 777,
        createdAt: now,
        lastPlayed: now,
        playerSpawn: { x: 16, y: 72, z: -8 },
        gameMode: 'survival',
        saveVersion: 1,
      }
      return Effect.gen(function* () {
        const storage = yield* StorageService
        yield* storage.saveWorldMetadata(testWorldId, validMeta)
        const loaded = Option.getOrThrow(yield* storage.loadWorldMetadata(testWorldId))
        expect(loaded.seed).toBe(777)
        expect(loaded.playerSpawn.x).toBe(16)
        expect(loaded.playerSpawn.y).toBe(72)
        expect(loaded.playerSpawn.z).toBe(-8)
        expect(loaded.createdAt).toBeInstanceOf(Date)
        expect(loaded.lastPlayed).toBeInstanceOf(Date)
      }).pipe(Effect.provide(TestLayer))
    })

    it.effect('returns Option.none for a worldId that was never saved', () => {
      const { TestLayer } = makeInMemoryStorageService()
      return Effect.gen(function* () {
        const storage = yield* StorageService
        expect(yield* storage.loadWorldMetadata('missing-world' as WorldId)).toStrictEqual(Option.none())
      }).pipe(Effect.provide(TestLayer))
    })

    it('Schema.decodeUnknown rejects metadata missing required createdAt field', () => {
      const now = new Date()
      expect(() =>
        Schema.decodeUnknownSync(WorldMetadataSchema)({
          seed: 42,
          // createdAt intentionally omitted
          lastPlayed: now,
          playerSpawn: { x: 0, y: 64, z: 0 },
        })
      ).toThrow()
    })

    it('Schema.decodeUnknown rejects metadata missing required lastPlayed field', () => {
      const now = new Date()
      expect(() =>
        Schema.decodeUnknownSync(WorldMetadataSchema)({
          seed: 42,
          createdAt: now,
          // lastPlayed intentionally omitted
          playerSpawn: { x: 0, y: 64, z: 0 },
        })
      ).toThrow()
    })

    it('Schema.decodeUnknown rejects metadata with non-Date createdAt value', () => {
      const now = new Date()
      expect(() =>
        Schema.decodeUnknownSync(WorldMetadataSchema)({
          seed: 42,
          createdAt: now.toISOString(), // string, not Date
          lastPlayed: now,
          playerSpawn: { x: 0, y: 64, z: 0 },
        })
      ).toThrow()
    })

    it('Schema.decodeUnknown rejects metadata with missing playerSpawn fields', () => {
      const now = new Date()
      expect(() =>
        Schema.decodeUnknownSync(WorldMetadataSchema)({
          seed: 42,
          createdAt: now,
          lastPlayed: now,
          playerSpawn: { x: 0, z: 0 }, // y missing
        })
      ).toThrow()
    })

    it('Schema.decodeUnknown accepts seed of 0 as valid', () => {
      const now = new Date()
      const result = Schema.decodeUnknownSync(WorldMetadataSchema)({
        seed: 0,
        createdAt: now,
        lastPlayed: now,
        playerSpawn: { x: 0, y: 64, z: 0 },
        gameMode: 'survival',
        saveVersion: 1,
      })
      expect(result.seed).toBe(0)
    })

    it('Schema.decodeUnknown rejects metadata with seed as non-number', () => {
      const now = new Date()
      expect(() =>
        Schema.decodeUnknownSync(WorldMetadataSchema)({
          seed: 'twelve',
          createdAt: now,
          lastPlayed: now,
          playerSpawn: { x: 0, y: 64, z: 0 },
        })
      ).toThrow()
    })

    it.effect('overwritten metadata returns the new values on load', () => {
      const { TestLayer } = makeInMemoryStorageService()
      const t1 = new Date(2024, 0, 1)
      const t2 = new Date(2024, 6, 1)
      const firstMeta: WorldMetadata = { seed: 1, createdAt: t1, lastPlayed: t1, playerSpawn: { x: 0, y: 64, z: 0 }, gameMode: 'survival', saveVersion: 1 }
      const secondMeta: WorldMetadata = { seed: 2, createdAt: t2, lastPlayed: t2, playerSpawn: { x: 8, y: 80, z: 8 }, gameMode: 'survival', saveVersion: 1 }
      return Effect.gen(function* () {
        const storage = yield* StorageService
        yield* storage.saveWorldMetadata(testWorldId, firstMeta)
        yield* storage.saveWorldMetadata(testWorldId, secondMeta)
        const loaded = Option.getOrThrow(yield* storage.loadWorldMetadata(testWorldId))
        expect(loaded.seed).toBe(2)
        expect(loaded.createdAt.getTime()).toBe(t2.getTime())
      }).pipe(Effect.provide(TestLayer))
    })
  })
})
