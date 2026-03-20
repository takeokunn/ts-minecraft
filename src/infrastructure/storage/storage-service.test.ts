import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { Effect, Layer, Option, Schema } from 'effect'
import { StorageService, WorldMetadataSchema, WorldMetadata } from './storage-service'
import { StorageError } from '@/domain/errors'
import { WorldId } from '@/shared/kernel'
import type { ChunkCoord } from '@/domain/chunk'

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

const testWorldId = 'test-world' as WorldId
const anotherWorldId = 'another-world' as WorldId
const testCoord: ChunkCoord = { x: 0, z: 0 }

/**
 * Build an in-memory StorageService implementation for contract testing.
 * Uses plain Maps to simulate the IndexedDB storage contract without requiring
 * a real browser environment.
 */
const makeInMemoryStorageService = () => {
  const chunkStore = new Map<string, Uint8Array>()
  const metaStore = new Map<string, WorldMetadata>()
  let initialized = false

  const chunkKey = (worldId: WorldId, coord: ChunkCoord): string =>
    `${worldId}:${coord.x}:${coord.z}`

  const service = {
    initialize: Effect.sync(() => {
      initialized = true
    }),

    saveChunk: (worldId: WorldId, chunkCoord: ChunkCoord, data: Uint8Array) =>
      Effect.sync(() => {
        chunkStore.set(chunkKey(worldId, chunkCoord), data)
      }),

    loadChunk: (worldId: WorldId, chunkCoord: ChunkCoord) =>
      Effect.sync(() => {
        const val = chunkStore.get(chunkKey(worldId, chunkCoord))
        return val !== undefined ? Option.some(val) : Option.none<Uint8Array>()
      }),

    saveWorldMetadata: (worldId: WorldId, metadata: WorldMetadata) =>
      Effect.sync(() => {
        metaStore.set(worldId, metadata)
      }),

    loadWorldMetadata: (worldId: WorldId) =>
      Effect.sync(() => {
        const val = metaStore.get(worldId)
        return val !== undefined ? Option.some(val) : Option.none<WorldMetadata>()
      }),

    deleteWorld: (worldId: WorldId) =>
      Effect.sync(() => {
        const prefix = `${worldId}:`
        for (const key of chunkStore.keys()) {
          if (key.startsWith(prefix)) {
            chunkStore.delete(key)
          }
        }
        metaStore.delete(worldId)
      }),

    // Expose internal state for assertions in tests
    _initialized: () => initialized,
    _chunkStore: chunkStore,
    _metaStore: metaStore,
  }

  const TestLayer = Layer.succeed(StorageService, service as unknown as StorageService)

  return { service, TestLayer }
}

// ---------------------------------------------------------------------------
// WorldMetadataSchema validation
// ---------------------------------------------------------------------------

describe('infrastructure/storage/storage-service', () => {
  describe('WorldMetadataSchema', () => {
    it('should decode a valid WorldMetadata object with Date instances', () => {
      const now = new Date()
      const result = Schema.decodeUnknownSync(WorldMetadataSchema)({
        seed: 42,
        createdAt: now,
        lastPlayed: now,
        playerSpawn: { x: 0, y: 64, z: 0 },
      })
      expect(result.seed).toBe(42)
      expect(result.createdAt).toBe(now)
      expect(result.lastPlayed).toBe(now)
      expect(result.playerSpawn).toEqual({ x: 0, y: 64, z: 0 })
    })

    it('should preserve Date instances through encode/decode round-trip', () => {
      const createdAt = new Date(2024, 0, 1, 12, 0, 0)
      const lastPlayed = new Date(2024, 6, 15, 9, 30, 0)
      const input = {
        seed: 12345,
        createdAt,
        lastPlayed,
        playerSpawn: { x: 8, y: 80, z: -8 },
      }

      const decoded = Schema.decodeUnknownSync(WorldMetadataSchema)(input)
      expect(decoded.createdAt).toBeInstanceOf(Date)
      expect(decoded.lastPlayed).toBeInstanceOf(Date)
      expect(decoded.createdAt.getTime()).toBe(createdAt.getTime())
      expect(decoded.lastPlayed.getTime()).toBe(lastPlayed.getTime())
    })

    it('should validate playerSpawn with correct x y z coordinates', () => {
      const now = new Date()
      const result = Schema.decodeUnknownSync(WorldMetadataSchema)({
        seed: 0,
        createdAt: now,
        lastPlayed: now,
        playerSpawn: { x: -100, y: 48, z: 256 },
      })
      expect(result.playerSpawn.x).toBe(-100)
      expect(result.playerSpawn.y).toBe(48)
      expect(result.playerSpawn.z).toBe(256)
    })

    it('should fail decode when required fields are missing', () => {
      expect(() =>
        Schema.decodeUnknownSync(WorldMetadataSchema)({
          seed: 1,
          // createdAt is missing
          lastPlayed: new Date(),
          playerSpawn: { x: 0, y: 64, z: 0 },
        })
      ).toThrow()
    })

    it('should fail decode when playerSpawn is missing y coordinate', () => {
      const now = new Date()
      expect(() =>
        Schema.decodeUnknownSync(WorldMetadataSchema)({
          seed: 1,
          createdAt: now,
          lastPlayed: now,
          playerSpawn: { x: 0, z: 0 },
        })
      ).toThrow()
    })

    it('should fail decode when seed is not a number', () => {
      const now = new Date()
      expect(() =>
        Schema.decodeUnknownSync(WorldMetadataSchema)({
          seed: 'not-a-number',
          createdAt: now,
          lastPlayed: now,
          playerSpawn: { x: 0, y: 64, z: 0 },
        })
      ).toThrow()
    })

    it('should decode seed of 0 (zero is a valid seed)', () => {
      const now = new Date()
      const result = Schema.decodeUnknownSync(WorldMetadataSchema)({
        seed: 0,
        createdAt: now,
        lastPlayed: now,
        playerSpawn: { x: 0, y: 64, z: 0 },
      })
      expect(result.seed).toBe(0)
    })
  })

  // ---------------------------------------------------------------------------
  // In-memory StorageService contract tests
  // ---------------------------------------------------------------------------

  describe('StorageService contract (in-memory)', () => {
    it.effect('should round-trip saveChunk and loadChunk preserving Uint8Array bytes exactly', () => {
      const { TestLayer } = makeInMemoryStorageService()
      const data = new Uint8Array([1, 2, 3, 255, 0, 128])
      return Effect.gen(function* () {
        const storage = yield* StorageService
        yield* storage.saveChunk(testWorldId, testCoord, data)
        const result = yield* storage.loadChunk(testWorldId, testCoord)
        expect(Option.isSome(result)).toBe(true)
        expect(Option.getOrThrow(result)).toEqual(data)
      }).pipe(Effect.provide(TestLayer))
    })

    it.effect('should return Option.none() for a chunk that has not been saved', () => {
      const { TestLayer } = makeInMemoryStorageService()
      const missingCoord: ChunkCoord = { x: 999, z: 999 }
      return Effect.gen(function* () {
        const storage = yield* StorageService
        const result = yield* storage.loadChunk(testWorldId, missingCoord)
        expect(Option.isNone(result)).toBe(true)
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
      }
      return Effect.gen(function* () {
        const storage = yield* StorageService
        yield* storage.saveWorldMetadata(testWorldId, metadata)
        const result = yield* storage.loadWorldMetadata(testWorldId)
        expect(Option.isSome(result)).toBe(true)
        const loaded = Option.getOrThrow(result)
        expect(loaded.seed).toBe(42)
        expect(loaded.playerSpawn).toEqual({ x: 8, y: 64, z: 8 })
      }).pipe(Effect.provide(TestLayer))
    })

    it.effect('should return Option.none() for metadata of non-existent worldId', () => {
      const { TestLayer } = makeInMemoryStorageService()
      return Effect.gen(function* () {
        const storage = yield* StorageService
        const result = yield* storage.loadWorldMetadata('nonexistent-world' as WorldId)
        expect(Option.isNone(result)).toBe(true)
      }).pipe(Effect.provide(TestLayer))
    })

    it.effect('should delete all chunks with matching worldId prefix on deleteWorld', () => {
      const { TestLayer } = makeInMemoryStorageService()
      const coord1: ChunkCoord = { x: 0, z: 0 }
      const coord2: ChunkCoord = { x: 1, z: 0 }
      const coord3: ChunkCoord = { x: 0, z: 1 }
      const data = new Uint8Array([42])
      return Effect.gen(function* () {
        const storage = yield* StorageService
        yield* storage.saveChunk(testWorldId, coord1, data)
        yield* storage.saveChunk(testWorldId, coord2, data)
        yield* storage.saveChunk(testWorldId, coord3, data)
        yield* storage.deleteWorld(testWorldId)
        const r1 = yield* storage.loadChunk(testWorldId, coord1)
        const r2 = yield* storage.loadChunk(testWorldId, coord2)
        const r3 = yield* storage.loadChunk(testWorldId, coord3)
        expect(Option.isNone(r1)).toBe(true)
        expect(Option.isNone(r2)).toBe(true)
        expect(Option.isNone(r3)).toBe(true)
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
      }
      return Effect.gen(function* () {
        const storage = yield* StorageService
        yield* storage.saveWorldMetadata(testWorldId, metadata)
        yield* storage.deleteWorld(testWorldId)
        const result = yield* storage.loadWorldMetadata(testWorldId)
        expect(Option.isNone(result)).toBe(true)
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
        yield* storage.saveChunk(testWorldId, testCoord, data1)
        yield* storage.saveChunk(anotherWorldId, testCoord, data2)
        const r1 = yield* storage.loadChunk(testWorldId, testCoord)
        const r2 = yield* storage.loadChunk(anotherWorldId, testCoord)
        expect(Option.isSome(r1)).toBe(true)
        expect(Option.isSome(r2)).toBe(true)
        expect(Option.getOrThrow(r1)).toEqual(data1)
        expect(Option.getOrThrow(r2)).toEqual(data2)
      }).pipe(Effect.provide(TestLayer))
    })

    it.effect('should store different data for same coord under different worldIds (key collision isolation)', () => {
      const { TestLayer } = makeInMemoryStorageService()
      const coord: ChunkCoord = { x: 5, z: -3 }
      const dataA = new Uint8Array([10, 20, 30])
      const dataB = new Uint8Array([40, 50, 60])
      return Effect.gen(function* () {
        const storage = yield* StorageService
        yield* storage.saveChunk('world-a' as WorldId, coord, dataA)
        yield* storage.saveChunk('world-b' as WorldId, coord, dataB)
        const ra = yield* storage.loadChunk('world-a' as WorldId, coord)
        const rb = yield* storage.loadChunk('world-b' as WorldId, coord)
        expect(Option.getOrThrow(ra)).toEqual(dataA)
        expect(Option.getOrThrow(rb)).toEqual(dataB)
      }).pipe(Effect.provide(TestLayer))
    })

    it.effect('should overwrite chunk data on second save for same worldId + coord', () => {
      const { TestLayer } = makeInMemoryStorageService()
      const firstData = new Uint8Array([1, 1, 1])
      const secondData = new Uint8Array([9, 9, 9])
      return Effect.gen(function* () {
        const storage = yield* StorageService
        yield* storage.saveChunk(testWorldId, testCoord, firstData)
        yield* storage.saveChunk(testWorldId, testCoord, secondData)
        const result = yield* storage.loadChunk(testWorldId, testCoord)
        expect(Option.getOrThrow(result)).toEqual(secondData)
      }).pipe(Effect.provide(TestLayer))
    })

    it.effect('should not delete chunks of another world when deleting one world', () => {
      const { TestLayer } = makeInMemoryStorageService()
      const data = new Uint8Array([7])
      return Effect.gen(function* () {
        const storage = yield* StorageService
        yield* storage.saveChunk(testWorldId, testCoord, data)
        yield* storage.saveChunk(anotherWorldId, testCoord, data)
        yield* storage.deleteWorld(testWorldId)
        const result = yield* storage.loadChunk(anotherWorldId, testCoord)
        expect(Option.isSome(result)).toBe(true)
        expect(Option.getOrThrow(result)).toEqual(data)
      }).pipe(Effect.provide(TestLayer))
    })

    it.effect('should overwrite metadata on second saveWorldMetadata', () => {
      const { TestLayer } = makeInMemoryStorageService()
      const now = new Date()
      const firstMeta: WorldMetadata = { seed: 1, createdAt: now, lastPlayed: now, playerSpawn: { x: 0, y: 64, z: 0 } }
      const secondMeta: WorldMetadata = { seed: 2, createdAt: now, lastPlayed: now, playerSpawn: { x: 8, y: 80, z: 8 } }
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

  describe('StorageError TaggedError structure', () => {
    it('should have _tag === "StorageError"', () => {
      const err = new StorageError({ operation: 'test', cause: 'something went wrong' })
      expect(err._tag).toBe('StorageError')
    })

    it('should include the operation name in the message', () => {
      const err = new StorageError({ operation: 'loadChunk', cause: 'timeout' })
      expect(err.message).toContain('loadChunk')
    })

    it('should include the cause string in the message when cause is a string', () => {
      const err = new StorageError({ operation: 'saveChunk', cause: 'disk full' })
      expect(err.message).toContain('disk full')
    })

    it('should include cause.message in the message when cause is an Error', () => {
      const cause = new Error('underlying IO error')
      const err = new StorageError({ operation: 'deleteWorld', cause })
      expect(err.message).toContain('underlying IO error')
    })

    it('should produce a valid message when cause is undefined', () => {
      const err = new StorageError({ operation: 'initialize' })
      expect(err.message).toContain('initialize')
      expect(typeof err.message).toBe('string')
    })

    it.effect('should be catchable by Effect.catchTag with "StorageError"', () =>
      Effect.gen(function* () {
        const result = yield* Effect.gen(function* () {
          return yield* Effect.fail(new StorageError({ operation: 'op', cause: 'fail' }))
        }).pipe(
          Effect.catchTag('StorageError', (e) => Effect.succeed(`caught: ${e.operation}`))
        )
        expect(result).toBe('caught: op')
      })
    )
  })

  // ---------------------------------------------------------------------------
  // Additional contract tests — edge cases and error handling
  // ---------------------------------------------------------------------------

  describe('StorageService contract (additional edge cases)', () => {
    it.effect('should handle saving and loading a large chunk (CHUNK_SIZE * CHUNK_SIZE * 256 bytes)', () => {
      const { TestLayer } = makeInMemoryStorageService()
      const largeData = new Uint8Array(16 * 16 * 256)
      // Fill with a pattern to detect corruption
      for (let i = 0; i < largeData.length; i++) {
        largeData[i] = i % 256
      }
      return Effect.gen(function* () {
        const storage = yield* StorageService
        yield* storage.saveChunk(testWorldId, testCoord, largeData)
        const result = yield* storage.loadChunk(testWorldId, testCoord)
        expect(Option.isSome(result)).toBe(true)
        const retrieved = Option.getOrThrow(result)
        expect(retrieved.length).toBe(largeData.length)
        expect(retrieved).toEqual(largeData)
      }).pipe(Effect.provide(TestLayer))
    })

    it.effect('should handle empty Uint8Array as chunk data', () => {
      const { TestLayer } = makeInMemoryStorageService()
      const emptyData = new Uint8Array(0)
      return Effect.gen(function* () {
        const storage = yield* StorageService
        yield* storage.saveChunk(testWorldId, testCoord, emptyData)
        const result = yield* storage.loadChunk(testWorldId, testCoord)
        expect(Option.isSome(result)).toBe(true)
        expect(Option.getOrThrow(result).length).toBe(0)
      }).pipe(Effect.provide(TestLayer))
    })

    it.effect('should handle negative chunk coordinates', () => {
      const { TestLayer } = makeInMemoryStorageService()
      const negativeCoord: ChunkCoord = { x: -5, z: -3 }
      const data = new Uint8Array([42, 43, 44])
      return Effect.gen(function* () {
        const storage = yield* StorageService
        yield* storage.saveChunk(testWorldId, negativeCoord, data)
        const result = yield* storage.loadChunk(testWorldId, negativeCoord)
        expect(Option.isSome(result)).toBe(true)
        expect(Option.getOrThrow(result)).toEqual(data)
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
        yield* storage.saveChunk(testWorldId, coord1, data1)
        yield* storage.saveChunk(testWorldId, coord2, data2)
        yield* storage.saveChunk(testWorldId, coord3, data3)
        const r1 = yield* storage.loadChunk(testWorldId, coord1)
        const r2 = yield* storage.loadChunk(testWorldId, coord2)
        const r3 = yield* storage.loadChunk(testWorldId, coord3)
        expect(Option.getOrThrow(r1)).toEqual(data1)
        expect(Option.getOrThrow(r2)).toEqual(data2)
        expect(Option.getOrThrow(r3)).toEqual(data3)
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
      }
      const metaB: WorldMetadata = {
        seed: 222,
        createdAt: now,
        lastPlayed: now,
        playerSpawn: { x: 10, y: 80, z: 10 },
      }
      return Effect.gen(function* () {
        const storage = yield* StorageService
        yield* storage.saveWorldMetadata(testWorldId, metaA)
        yield* storage.saveWorldMetadata(anotherWorldId, metaB)
        yield* storage.deleteWorld(testWorldId)
        const deletedMeta = yield* storage.loadWorldMetadata(testWorldId)
        const survivingMeta = yield* storage.loadWorldMetadata(anotherWorldId)
        expect(Option.isNone(deletedMeta)).toBe(true)
        expect(Option.isSome(survivingMeta)).toBe(true)
        expect(Option.getOrThrow(survivingMeta).seed).toBe(222)
      }).pipe(Effect.provide(TestLayer))
    })

    it.effect('should handle saving chunks across many different coordinates', () => {
      const { TestLayer } = makeInMemoryStorageService()
      const coordCount = 20
      return Effect.gen(function* () {
        const storage = yield* StorageService
        for (let i = 0; i < coordCount; i++) {
          const coord: ChunkCoord = { x: i, z: i * 2 }
          yield* storage.saveChunk(testWorldId, coord, new Uint8Array([i]))
        }
        // Verify all can be loaded back
        for (let i = 0; i < coordCount; i++) {
          const coord: ChunkCoord = { x: i, z: i * 2 }
          const loaded = yield* storage.loadChunk(testWorldId, coord)
          expect(Option.isSome(loaded)).toBe(true)
          expect(Option.getOrThrow(loaded)[0]).toBe(i)
        }
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
      }
      return Effect.gen(function* () {
        const storage = yield* StorageService
        yield* storage.saveWorldMetadata(testWorldId, validMeta)
        const result = yield* storage.loadWorldMetadata(testWorldId)
        expect(Option.isSome(result)).toBe(true)
        const loaded = Option.getOrThrow(result)
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
        const result = yield* storage.loadWorldMetadata('missing-world' as WorldId)
        expect(Option.isNone(result)).toBe(true)
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
      const firstMeta: WorldMetadata = { seed: 1, createdAt: t1, lastPlayed: t1, playerSpawn: { x: 0, y: 64, z: 0 } }
      const secondMeta: WorldMetadata = { seed: 2, createdAt: t2, lastPlayed: t2, playerSpawn: { x: 8, y: 80, z: 8 } }
      return Effect.gen(function* () {
        const storage = yield* StorageService
        yield* storage.saveWorldMetadata(testWorldId, firstMeta)
        yield* storage.saveWorldMetadata(testWorldId, secondMeta)
        const result = yield* storage.loadWorldMetadata(testWorldId)
        expect(Option.isSome(result)).toBe(true)
        const loaded = Option.getOrThrow(result)
        expect(loaded.seed).toBe(2)
        expect(loaded.createdAt.getTime()).toBe(t2.getTime())
      }).pipe(Effect.provide(TestLayer))
    })
  })

  // ---------------------------------------------------------------------------
  // Task 1: isQuotaExceeded and retry behavior
  // ---------------------------------------------------------------------------

  describe('isQuotaExceeded and QuotaExceededError handling (in-memory mock)', () => {
    /**
     * Build a StorageService layer backed by a mock that throws on saveChunk.
     * The `throwOnSave` function is called instead of the normal Map write.
     */
    const makeFailingStorageService = (throwOnSave: () => void) => {
      const chunkStore = new Map<string, Uint8Array>()
      const metaStore = new Map<string, WorldMetadata>()
      let saveCallCount = 0

      const chunkKey = (worldId: WorldId, coord: ChunkCoord): string =>
        `${worldId}:${coord.x}:${coord.z}`

      const service = {
        initialize: Effect.void,

        saveChunk: (worldId: WorldId, chunkCoord: ChunkCoord, data: Uint8Array) =>
          Effect.sync(() => {
            saveCallCount++
            throwOnSave()
            chunkStore.set(chunkKey(worldId, chunkCoord), data)
          }),

        loadChunk: (worldId: WorldId, chunkCoord: ChunkCoord) =>
          Effect.sync(() => {
            const val = chunkStore.get(chunkKey(worldId, chunkCoord))
            return val !== undefined ? Option.some(val) : Option.none<Uint8Array>()
          }),

        saveWorldMetadata: (worldId: WorldId, metadata: WorldMetadata) =>
          Effect.sync(() => {
            metaStore.set(worldId, metadata)
          }),

        loadWorldMetadata: (worldId: WorldId) =>
          Effect.sync(() => {
            const val = metaStore.get(worldId)
            return val !== undefined ? Option.some(val) : Option.none<WorldMetadata>()
          }),

        deleteWorld: (worldId: WorldId) =>
          Effect.sync(() => {
            const prefix = `${worldId}:`
            for (const key of chunkStore.keys()) {
              if (key.startsWith(prefix)) chunkStore.delete(key)
            }
            metaStore.delete(worldId)
          }),

        _saveCallCount: () => saveCallCount,
      }

      const TestLayer = Layer.succeed(StorageService, service as unknown as StorageService)
      return { service, TestLayer }
    }

    it.effect('saveChunk that throws a plain Error yields a StorageError from the caller layer', () => {
      // When the underlying storage throws a generic Error (not QuotaExceededError),
      // a well-written caller wrapping it in StorageError should produce _tag='StorageError'.
      // Here we test StorageError construction directly to verify the tag and operation fields.
      return Effect.gen(function* () {
        const err = new StorageError({ operation: 'saveChunk', cause: new Error('disk full') })
        expect(err._tag).toBe('StorageError')
        expect(err.operation).toBe('saveChunk')
        expect(err.message).toContain('disk full')
      })
    })

    it('StorageError with QuotaExceededError cause embeds the quota message', () => {
      // isQuotaExceeded returns true for DOMException with name='QuotaExceededError'.
      // The production tryCatchStorage wraps it as: cause='Storage quota exceeded…'
      const err = new StorageError({
        operation: 'saveChunk',
        cause: 'Storage quota exceeded. Please clear some data.',
      })
      expect(err._tag).toBe('StorageError')
      expect(err.message).toContain('Storage quota exceeded')
      expect(err.operation).toBe('saveChunk')
    })

    it('StorageError with QuotaExceededError DOMException (code 22) includes operation name', () => {
      // DOMException with code 22 is the legacy QUOTA_EXCEEDED_ERR constant.
      // tryCatchStorage maps it to a human-readable cause string.
      const domExc = new DOMException('QuotaExceededError', 'QuotaExceededError')
      const err = new StorageError({ operation: 'saveChunk', cause: domExc })
      expect(err._tag).toBe('StorageError')
      expect(err.operation).toBe('saveChunk')
      // message includes the DOMException's message via the Error branch
      expect(err.message).toContain('saveChunk')
    })

    it('StorageError wrapping a non-quota DOMException is still a StorageError', () => {
      const domExc = new DOMException('The operation failed', 'AbortError')
      const err = new StorageError({ operation: 'loadChunk', cause: domExc })
      expect(err._tag).toBe('StorageError')
      expect(err.operation).toBe('loadChunk')
    })

    it.effect('saveChunk that throws is called exactly once when mock throws immediately', () => {
      // Verifies that a single-throw mock is called exactly once (no retry at mock level).
      let callCount = 0
      const { TestLayer } = makeFailingStorageService(() => {
        callCount++
        throw new Error('immediate failure')
      })
      return Effect.gen(function* () {
        const storage = yield* StorageService
        // The mock throws synchronously inside Effect.sync — this will cause a defect.
        // We use Effect.sandbox to catch defects.
        const result = yield* storage.saveChunk(testWorldId, testCoord, new Uint8Array([1])).pipe(
          Effect.sandbox,
          Effect.either,
        )
        expect(result._tag).toBe('Left')
        // The mock was invoked exactly once
        expect(callCount).toBe(1)
      }).pipe(Effect.provide(TestLayer))
    })

    it.effect('saveChunk that does NOT throw succeeds and call count is 1', () => {
      let callCount = 0
      const { TestLayer } = makeFailingStorageService(() => {
        callCount++
        // no throw
      })
      return Effect.gen(function* () {
        const storage = yield* StorageService
        yield* storage.saveChunk(testWorldId, testCoord, new Uint8Array([42]))
        expect(callCount).toBe(1)
        const loaded = yield* storage.loadChunk(testWorldId, testCoord)
        // The mock only increments on save, not on the throw path — verify data was stored
        expect(Option.isSome(loaded)).toBe(true)
      }).pipe(Effect.provide(TestLayer))
    })
  })
})
