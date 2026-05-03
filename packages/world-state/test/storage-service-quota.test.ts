import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { Array as Arr, Effect, Either, MutableHashMap, MutableRef, Option } from 'effect'
import { StorageService, WorldMetadata } from '@ts-minecraft/world-state'
import { StorageError } from '../domain/errors'
import { WorldId } from '@ts-minecraft/kernel'
import { testWorldId, testCoord, chunkStorageBlocks, chunkStorageValue, makeInMemoryStorageService, makeFailingStorageService } from './storage-service-test-utils'

// ---------------------------------------------------------------------------
// isQuotaExceeded and QuotaExceededError handling (in-memory mock)
// ---------------------------------------------------------------------------

describe('infrastructure/storage/storage-service-quota', () => {
  describe('isQuotaExceeded and QuotaExceededError handling (in-memory mock)', () => {
    it.effect('saveChunk that throws a plain Error yields a StorageError from the caller layer', () => {
      // When the underlying storage throws a generic Error (not QuotaExceededError),
      // a well-written caller wrapping it in StorageError should produce _tag='StorageError'.
      // Here we test StorageError construction directly to verify the tag and operation fields.
      return Effect.sync(() => {
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
      const callCountRef = MutableRef.make(0)
      const { TestLayer } = makeFailingStorageService(() => {
        MutableRef.updateAndGet(callCountRef, n => n + 1)
        throw new Error('immediate failure')
      })
      return Effect.gen(function* () {
        const storage = yield* StorageService
        // The mock throws synchronously inside Effect.sync — this will cause a defect.
        // We use Effect.sandbox to catch defects.
        const result = yield* storage.saveChunk(testWorldId, testCoord, chunkStorageValue(new Uint8Array([1]))).pipe(
          Effect.sandbox,
          Effect.either,
        )
        expect(Either.isLeft(result)).toBe(true)
        // The mock was invoked exactly once
        expect(MutableRef.get(callCountRef)).toBe(1)
      }).pipe(Effect.provide(TestLayer))
    })

    it.effect('saveChunk that does NOT throw succeeds and call count is 1', () => {
      const callCountRef = MutableRef.make(0)
      const { TestLayer } = makeFailingStorageService(() => {
        MutableRef.updateAndGet(callCountRef, n => n + 1)
        // no throw
      })
      return Effect.gen(function* () {
        const storage = yield* StorageService
        const blocks = new Uint8Array([42])
        yield* storage.saveChunk(testWorldId, testCoord, chunkStorageValue(blocks))
        expect(MutableRef.get(callCountRef)).toBe(1)
        const loaded = yield* storage.loadChunk(testWorldId, testCoord)
        // The mock only increments on save, not on the throw path — verify data was stored
        expect(chunkStorageBlocks(Option.getOrThrow(loaded))).toEqual(blocks)
      }).pipe(Effect.provide(TestLayer))
    })
  })

  // ---------------------------------------------------------------------------
  // listWorldMetadata — main-menu world list (FR-1.1) + corrupt-row recovery
  // ---------------------------------------------------------------------------

  describe('listWorldMetadata', () => {
    it.effect('returns empty arrays when no worlds are saved', () => {
      const { TestLayer } = makeInMemoryStorageService()
      return Effect.gen(function* () {
        const storage = yield* StorageService
        const result = yield* storage.listWorldMetadata
        expect(result.valid).toEqual([])
        expect(result.corrupt).toEqual([])
      }).pipe(Effect.provide(TestLayer))
    })

    it.effect('returns every saved world in valid array (unsorted is acceptable)', () => {
      const { TestLayer } = makeInMemoryStorageService()
      const now = new Date()
      const earlier = new Date(now.getTime() - 60_000)
      const meta1: WorldMetadata = {
        seed: 1, createdAt: earlier, lastPlayed: earlier,
        playerSpawn: { x: 0, y: 64, z: 0 },
        gameMode: 'survival', saveVersion: 1,
      }
      const meta2: WorldMetadata = {
        seed: 2, createdAt: now, lastPlayed: now,
        playerSpawn: { x: 0, y: 64, z: 0 },
        gameMode: 'creative', saveVersion: 1,
      }
      return Effect.gen(function* () {
        const storage = yield* StorageService
        yield* storage.saveWorldMetadata('world-a' as WorldId, meta1)
        yield* storage.saveWorldMetadata('world-b' as WorldId, meta2)
        const result = yield* storage.listWorldMetadata
        expect(result.valid.length).toBe(2)
        expect(result.corrupt).toEqual([])
        const worldIds = Arr.map(result.valid, (entry) => entry.worldId).sort()
        expect(worldIds).toEqual(['world-a', 'world-b'])
      }).pipe(Effect.provide(TestLayer))
    })

    it.effect('separates corrupt rows that fail Schema.decodeUnknown', () => {
      const { service, TestLayer } = makeInMemoryStorageService()
      const now = new Date()
      const validMeta: WorldMetadata = {
        seed: 7, createdAt: now, lastPlayed: now,
        playerSpawn: { x: 0, y: 64, z: 0 },
        gameMode: 'survival', saveVersion: 1,
      }
      // Bypass the typed mock API and inject a malformed record directly into
      // the underlying meta store so the schema decode path observes garbage.
      MutableHashMap.set(service._metaStore, 'broken-world' as WorldId, {
        seed: 'not-a-number',
        notAValidShape: true,
      })
      return Effect.gen(function* () {
        const storage = yield* StorageService
        yield* storage.saveWorldMetadata('good-world' as WorldId, validMeta)
        const result = yield* storage.listWorldMetadata
        expect(result.valid.length).toBe(1)
        expect(result.valid[0]?.worldId).toBe('good-world')
        expect(result.corrupt).toContain('broken-world')
      }).pipe(Effect.provide(TestLayer))
    })

    it.effect('result preserves the gameMode badge field for the menu UI', () => {
      const { TestLayer } = makeInMemoryStorageService()
      const now = new Date()
      const meta: WorldMetadata = {
        seed: 99, createdAt: now, lastPlayed: now,
        playerSpawn: { x: 0, y: 64, z: 0 },
        gameMode: 'creative', saveVersion: 1,
      }
      return Effect.gen(function* () {
        const storage = yield* StorageService
        yield* storage.saveWorldMetadata('hardcore-world' as WorldId, meta)
        const result = yield* storage.listWorldMetadata
        expect(result.valid[0]?.metadata.gameMode).toBe('creative')
      }).pipe(Effect.provide(TestLayer))
    })
  })
})
