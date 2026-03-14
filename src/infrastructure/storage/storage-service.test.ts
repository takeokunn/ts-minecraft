import { describe, it, expect } from 'vitest'
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
        for (const key of [...chunkStore.keys()]) {
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
    it('should round-trip saveChunk and loadChunk preserving Uint8Array bytes exactly', () => {
      const { TestLayer } = makeInMemoryStorageService()
      const data = new Uint8Array([1, 2, 3, 255, 0, 128])

      const program = Effect.gen(function* () {
        const storage = yield* StorageService
        yield* storage.saveChunk(testWorldId, testCoord, data)
        const loaded = yield* storage.loadChunk(testWorldId, testCoord)
        return loaded
      }).pipe(Effect.provide(TestLayer))

      const result = Effect.runSync(program)
      expect(Option.isSome(result)).toBe(true)
      const retrieved = Option.getOrThrow(result)
      expect(retrieved).toEqual(data)
    })

    it('should return Option.none() for a chunk that has not been saved', () => {
      const { TestLayer } = makeInMemoryStorageService()
      const missingCoord: ChunkCoord = { x: 999, z: 999 }

      const program = Effect.gen(function* () {
        const storage = yield* StorageService
        return yield* storage.loadChunk(testWorldId, missingCoord)
      }).pipe(Effect.provide(TestLayer))

      const result = Effect.runSync(program)
      expect(Option.isNone(result)).toBe(true)
    })

    it('should round-trip saveWorldMetadata and loadWorldMetadata', () => {
      const { TestLayer } = makeInMemoryStorageService()
      const now = new Date()
      const metadata: WorldMetadata = {
        seed: 42,
        createdAt: now,
        lastPlayed: now,
        playerSpawn: { x: 8, y: 64, z: 8 },
      }

      const program = Effect.gen(function* () {
        const storage = yield* StorageService
        yield* storage.saveWorldMetadata(testWorldId, metadata)
        return yield* storage.loadWorldMetadata(testWorldId)
      }).pipe(Effect.provide(TestLayer))

      const result = Effect.runSync(program)
      expect(Option.isSome(result)).toBe(true)
      const loaded = Option.getOrThrow(result)
      expect(loaded.seed).toBe(42)
      expect(loaded.playerSpawn).toEqual({ x: 8, y: 64, z: 8 })
    })

    it('should return Option.none() for metadata of non-existent worldId', () => {
      const { TestLayer } = makeInMemoryStorageService()

      const program = Effect.gen(function* () {
        const storage = yield* StorageService
        return yield* storage.loadWorldMetadata('nonexistent-world' as WorldId)
      }).pipe(Effect.provide(TestLayer))

      const result = Effect.runSync(program)
      expect(Option.isNone(result)).toBe(true)
    })

    it('should delete all chunks with matching worldId prefix on deleteWorld', () => {
      const { TestLayer } = makeInMemoryStorageService()
      const coord1: ChunkCoord = { x: 0, z: 0 }
      const coord2: ChunkCoord = { x: 1, z: 0 }
      const coord3: ChunkCoord = { x: 0, z: 1 }
      const data = new Uint8Array([42])

      const program = Effect.gen(function* () {
        const storage = yield* StorageService
        yield* storage.saveChunk(testWorldId, coord1, data)
        yield* storage.saveChunk(testWorldId, coord2, data)
        yield* storage.saveChunk(testWorldId, coord3, data)
        yield* storage.deleteWorld(testWorldId)
        const r1 = yield* storage.loadChunk(testWorldId, coord1)
        const r2 = yield* storage.loadChunk(testWorldId, coord2)
        const r3 = yield* storage.loadChunk(testWorldId, coord3)
        return { r1, r2, r3 }
      }).pipe(Effect.provide(TestLayer))

      const { r1, r2, r3 } = Effect.runSync(program)
      expect(Option.isNone(r1)).toBe(true)
      expect(Option.isNone(r2)).toBe(true)
      expect(Option.isNone(r3)).toBe(true)
    })

    it('should delete metadata for the world on deleteWorld', () => {
      const { TestLayer } = makeInMemoryStorageService()
      const now = new Date()
      const metadata: WorldMetadata = {
        seed: 99,
        createdAt: now,
        lastPlayed: now,
        playerSpawn: { x: 0, y: 64, z: 0 },
      }

      const program = Effect.gen(function* () {
        const storage = yield* StorageService
        yield* storage.saveWorldMetadata(testWorldId, metadata)
        yield* storage.deleteWorld(testWorldId)
        return yield* storage.loadWorldMetadata(testWorldId)
      }).pipe(Effect.provide(TestLayer))

      const result = Effect.runSync(program)
      expect(Option.isNone(result)).toBe(true)
    })

    it('should treat initialize as idempotent — calling twice does not error', () => {
      const { TestLayer } = makeInMemoryStorageService()

      const program = Effect.gen(function* () {
        const storage = yield* StorageService
        yield* storage.initialize
        yield* storage.initialize
        return 'ok'
      }).pipe(Effect.provide(TestLayer))

      const result = Effect.runSync(program)
      expect(result).toBe('ok')
    })

    it('should keep multiple worlds coexisting without collision', () => {
      const { TestLayer } = makeInMemoryStorageService()
      const data1 = new Uint8Array([1])
      const data2 = new Uint8Array([2])

      const program = Effect.gen(function* () {
        const storage = yield* StorageService
        yield* storage.saveChunk(testWorldId, testCoord, data1)
        yield* storage.saveChunk(anotherWorldId, testCoord, data2)
        const r1 = yield* storage.loadChunk(testWorldId, testCoord)
        const r2 = yield* storage.loadChunk(anotherWorldId, testCoord)
        return { r1, r2 }
      }).pipe(Effect.provide(TestLayer))

      const { r1, r2 } = Effect.runSync(program)
      expect(Option.isSome(r1)).toBe(true)
      expect(Option.isSome(r2)).toBe(true)
      expect(Option.getOrThrow(r1)).toEqual(data1)
      expect(Option.getOrThrow(r2)).toEqual(data2)
    })

    it('should store different data for same coord under different worldIds (key collision isolation)', () => {
      const { TestLayer } = makeInMemoryStorageService()
      const coord: ChunkCoord = { x: 5, z: -3 }
      const dataA = new Uint8Array([10, 20, 30])
      const dataB = new Uint8Array([40, 50, 60])

      const program = Effect.gen(function* () {
        const storage = yield* StorageService
        yield* storage.saveChunk('world-a' as WorldId, coord, dataA)
        yield* storage.saveChunk('world-b' as WorldId, coord, dataB)
        const ra = yield* storage.loadChunk('world-a' as WorldId, coord)
        const rb = yield* storage.loadChunk('world-b' as WorldId, coord)
        return { ra, rb }
      }).pipe(Effect.provide(TestLayer))

      const { ra, rb } = Effect.runSync(program)
      expect(Option.getOrThrow(ra)).toEqual(dataA)
      expect(Option.getOrThrow(rb)).toEqual(dataB)
    })

    it('should overwrite chunk data on second save for same worldId + coord', () => {
      const { TestLayer } = makeInMemoryStorageService()
      const firstData = new Uint8Array([1, 1, 1])
      const secondData = new Uint8Array([9, 9, 9])

      const program = Effect.gen(function* () {
        const storage = yield* StorageService
        yield* storage.saveChunk(testWorldId, testCoord, firstData)
        yield* storage.saveChunk(testWorldId, testCoord, secondData)
        return yield* storage.loadChunk(testWorldId, testCoord)
      }).pipe(Effect.provide(TestLayer))

      const result = Effect.runSync(program)
      expect(Option.getOrThrow(result)).toEqual(secondData)
    })

    it('should not delete chunks of another world when deleting one world', () => {
      const { TestLayer } = makeInMemoryStorageService()
      const data = new Uint8Array([7])

      const program = Effect.gen(function* () {
        const storage = yield* StorageService
        yield* storage.saveChunk(testWorldId, testCoord, data)
        yield* storage.saveChunk(anotherWorldId, testCoord, data)
        yield* storage.deleteWorld(testWorldId)
        return yield* storage.loadChunk(anotherWorldId, testCoord)
      }).pipe(Effect.provide(TestLayer))

      const result = Effect.runSync(program)
      expect(Option.isSome(result)).toBe(true)
      expect(Option.getOrThrow(result)).toEqual(data)
    })

    it('should overwrite metadata on second saveWorldMetadata', () => {
      const { TestLayer } = makeInMemoryStorageService()
      const now = new Date()
      const firstMeta: WorldMetadata = { seed: 1, createdAt: now, lastPlayed: now, playerSpawn: { x: 0, y: 64, z: 0 } }
      const secondMeta: WorldMetadata = { seed: 2, createdAt: now, lastPlayed: now, playerSpawn: { x: 8, y: 80, z: 8 } }

      const program = Effect.gen(function* () {
        const storage = yield* StorageService
        yield* storage.saveWorldMetadata(testWorldId, firstMeta)
        yield* storage.saveWorldMetadata(testWorldId, secondMeta)
        return yield* storage.loadWorldMetadata(testWorldId)
      }).pipe(Effect.provide(TestLayer))

      const result = Effect.runSync(program)
      const loaded = Option.getOrThrow(result)
      expect(loaded.seed).toBe(2)
      expect(loaded.playerSpawn).toEqual({ x: 8, y: 80, z: 8 })
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

    it('should be catchable by Effect.catchTag with "StorageError"', () => {
      const program = Effect.gen(function* () {
        return yield* Effect.fail(new StorageError({ operation: 'op', cause: 'fail' }))
      }).pipe(
        Effect.catchTag('StorageError', (e) => Effect.succeed(`caught: ${e.operation}`))
      )

      const result = Effect.runSync(program)
      expect(result).toBe('caught: op')
    })
  })

  // ---------------------------------------------------------------------------
  // Additional contract tests — edge cases and error handling
  // ---------------------------------------------------------------------------

  describe('StorageService contract (additional edge cases)', () => {
    it('should handle saving and loading a large chunk (CHUNK_SIZE * CHUNK_SIZE * 256 bytes)', () => {
      const { TestLayer } = makeInMemoryStorageService()
      const largeData = new Uint8Array(16 * 16 * 256)
      // Fill with a pattern to detect corruption
      for (let i = 0; i < largeData.length; i++) {
        largeData[i] = i % 256
      }

      const program = Effect.gen(function* () {
        const storage = yield* StorageService
        yield* storage.saveChunk(testWorldId, testCoord, largeData)
        const loaded = yield* storage.loadChunk(testWorldId, testCoord)
        return loaded
      }).pipe(Effect.provide(TestLayer))

      const result = Effect.runSync(program)
      expect(Option.isSome(result)).toBe(true)
      const retrieved = Option.getOrThrow(result)
      expect(retrieved.length).toBe(largeData.length)
      expect(retrieved).toEqual(largeData)
    })

    it('should handle empty Uint8Array as chunk data', () => {
      const { TestLayer } = makeInMemoryStorageService()
      const emptyData = new Uint8Array(0)

      const program = Effect.gen(function* () {
        const storage = yield* StorageService
        yield* storage.saveChunk(testWorldId, testCoord, emptyData)
        const loaded = yield* storage.loadChunk(testWorldId, testCoord)
        return loaded
      }).pipe(Effect.provide(TestLayer))

      const result = Effect.runSync(program)
      expect(Option.isSome(result)).toBe(true)
      expect(Option.getOrThrow(result).length).toBe(0)
    })

    it('should handle negative chunk coordinates', () => {
      const { TestLayer } = makeInMemoryStorageService()
      const negativeCoord: ChunkCoord = { x: -5, z: -3 }
      const data = new Uint8Array([42, 43, 44])

      const program = Effect.gen(function* () {
        const storage = yield* StorageService
        yield* storage.saveChunk(testWorldId, negativeCoord, data)
        const loaded = yield* storage.loadChunk(testWorldId, negativeCoord)
        return loaded
      }).pipe(Effect.provide(TestLayer))

      const result = Effect.runSync(program)
      expect(Option.isSome(result)).toBe(true)
      expect(Option.getOrThrow(result)).toEqual(data)
    })

    it('should correctly isolate chunks at nearby coordinates', () => {
      const { TestLayer } = makeInMemoryStorageService()
      const coord1: ChunkCoord = { x: 0, z: 0 }
      const coord2: ChunkCoord = { x: 0, z: 1 }
      const coord3: ChunkCoord = { x: 1, z: 0 }
      const data1 = new Uint8Array([1])
      const data2 = new Uint8Array([2])
      const data3 = new Uint8Array([3])

      const program = Effect.gen(function* () {
        const storage = yield* StorageService
        yield* storage.saveChunk(testWorldId, coord1, data1)
        yield* storage.saveChunk(testWorldId, coord2, data2)
        yield* storage.saveChunk(testWorldId, coord3, data3)
        const r1 = yield* storage.loadChunk(testWorldId, coord1)
        const r2 = yield* storage.loadChunk(testWorldId, coord2)
        const r3 = yield* storage.loadChunk(testWorldId, coord3)
        return { r1, r2, r3 }
      }).pipe(Effect.provide(TestLayer))

      const { r1, r2, r3 } = Effect.runSync(program)
      expect(Option.getOrThrow(r1)).toEqual(data1)
      expect(Option.getOrThrow(r2)).toEqual(data2)
      expect(Option.getOrThrow(r3)).toEqual(data3)
    })

    it('should deleteWorld for a world with no chunks (no error)', () => {
      const { TestLayer } = makeInMemoryStorageService()

      const program = Effect.gen(function* () {
        const storage = yield* StorageService
        // Delete a world that was never created
        yield* storage.deleteWorld('never-existed' as WorldId)
        return 'ok'
      }).pipe(Effect.provide(TestLayer))

      const result = Effect.runSync(program)
      expect(result).toBe('ok')
    })

    it('should preserve metadata of other worlds when deleting one world', () => {
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

      const program = Effect.gen(function* () {
        const storage = yield* StorageService
        yield* storage.saveWorldMetadata(testWorldId, metaA)
        yield* storage.saveWorldMetadata(anotherWorldId, metaB)
        yield* storage.deleteWorld(testWorldId)
        const deletedMeta = yield* storage.loadWorldMetadata(testWorldId)
        const survivingMeta = yield* storage.loadWorldMetadata(anotherWorldId)
        return { deletedMeta, survivingMeta }
      }).pipe(Effect.provide(TestLayer))

      const { deletedMeta, survivingMeta } = Effect.runSync(program)
      expect(Option.isNone(deletedMeta)).toBe(true)
      expect(Option.isSome(survivingMeta)).toBe(true)
      expect(Option.getOrThrow(survivingMeta).seed).toBe(222)
    })

    it('should handle saving chunks across many different coordinates', () => {
      const { TestLayer } = makeInMemoryStorageService()
      const coordCount = 20

      const program = Effect.gen(function* () {
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
        return { success: true }
      }).pipe(Effect.provide(TestLayer))

      const result = Effect.runSync(program)
      expect(result.success).toBe(true)
    })
  })
})
