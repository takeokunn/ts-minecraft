import { describe, it } from '@effect/vitest'
import { afterEach, beforeEach, expect, vi } from 'vitest'
import { Effect, MutableHashMap, MutableRef, Option } from 'effect'
import { StorageService, StorageServiceLive } from '@ts-minecraft/world-state'
import { WORLD_SCHEMA_VERSION } from '@ts-minecraft/terrain'

// Tests for the StorageService version-gate subroutine.
//
// The gate reads `localStorage['minecraft-worlds.schema-version']` before
// opening the IndexedDB database. If the stored value does not match
// `String(WORLD_SCHEMA_VERSION)`, it calls `indexedDB.deleteDatabase('minecraft-worlds')`
// and writes the current version string back into localStorage.
//
// Rationale: v2 (single-noise) chunks would produce 50+ block seam cliffs when
// rendered alongside v3 (multi-noise) chunks — so we wipe instead of migrate.

const SCHEMA_VERSION_LS_KEY = 'minecraft-worlds.schema-version'
const DB_NAME = 'minecraft-worlds'

type DeleteRequestLike = {
  onsuccess: ((this: IDBRequest, ev: Event) => void) | null
  onerror: ((this: IDBRequest, ev: Event) => void) | null
  onblocked: ((this: IDBRequest, ev: Event) => void) | null
  result: unknown
  error: DOMException | null
  readyState: 'pending' | 'done'
  source: IDBObjectStore | IDBIndex | null
  transaction: IDBTransaction | null
}

type OpenRequestLike = DeleteRequestLike & {
  onupgradeneeded: ((this: IDBRequest, ev: IDBVersionChangeEvent) => void) | null
  result: { objectStoreNames: { contains: (n: string) => boolean; includes?: never }; close: () => void; createObjectStore: (n: string) => void }
}

type FireBehavior = 'success' | 'error'

describe('infrastructure/storage/storage-service — version gate', () => {
  let store: MutableHashMap.MutableHashMap<string, string>
  let getItemSpy: ReturnType<typeof vi.fn>
  let setItemSpy: ReturnType<typeof vi.fn>
  let deleteDatabaseSpy: ReturnType<typeof vi.fn>
  let deleteBehaviorRef: MutableRef.MutableRef<FireBehavior>

  beforeEach(() => {
    store = MutableHashMap.empty<string, string>()
    deleteBehaviorRef = MutableRef.make<FireBehavior>('success')

    getItemSpy = vi.fn((key: string) => Option.getOrNull(MutableHashMap.get(store, key)))
    setItemSpy = vi.fn((key: string, value: string) => {
      MutableHashMap.set(store, key, value)
    })

    vi.stubGlobal('localStorage', {
      getItem: getItemSpy,
      setItem: setItemSpy,
      removeItem: vi.fn((key: string) => { MutableHashMap.remove(store, key) }),
      clear: vi.fn(),
      key: vi.fn(),
      length: 0,
    })

    // Build a stub IndexedDB that captures the deleteDatabase call and
    // synchronously fires success/error on the returned request after
    // the caller has attached handlers (microtask).
    deleteDatabaseSpy = vi.fn((_name: string): DeleteRequestLike => {
      const req: DeleteRequestLike = {
        onsuccess: null,
        onerror: null,
        onblocked: null,
        result: undefined,
        error: null,
        readyState: 'pending',
        source: null,
        transaction: null,
      }
      // Fire asynchronously (like real IDB) so handlers are attached first.
      queueMicrotask(() => {
        if (MutableRef.get(deleteBehaviorRef) === 'success') {
          req.result = undefined
          req.readyState = 'done'
          req.onsuccess?.call(req as unknown as IDBRequest, new Event('success'))
        } else {
          req.error = new DOMException('simulated delete failure', 'UnknownError')
          req.readyState = 'done'
          req.onerror?.call(req as unknown as IDBRequest, new Event('error'))
        }
      })
      return req
    })

    const openDatabaseStub = vi.fn((_name: string, _version: number): OpenRequestLike => {
      const fakeDb = {
        objectStoreNames: { contains: (_: string) => true },
        close: () => {},
        createObjectStore: (_: string) => {},
      } as unknown as OpenRequestLike['result']
      const req: OpenRequestLike = {
        onsuccess: null,
        onerror: null,
        onblocked: null,
        onupgradeneeded: null,
        result: fakeDb,
        error: null,
        readyState: 'pending',
        source: null,
        transaction: null,
      }
      queueMicrotask(() => {
        req.readyState = 'done'
        req.onsuccess?.call(req as unknown as IDBRequest, new Event('success'))
      })
      return req
    })

    vi.stubGlobal('indexedDB', {
      deleteDatabase: deleteDatabaseSpy,
      open: openDatabaseStub,
      databases: vi.fn(async () => []),
      cmp: (_a: unknown, _b: unknown) => 0,
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it.effect('empty localStorage: triggers wipe and sets version key to current version', () =>
    Effect.gen(function* () {
      const storage = yield* StorageService
      yield* storage.initialize
      expect(deleteDatabaseSpy).toHaveBeenCalledTimes(1)
      expect(deleteDatabaseSpy).toHaveBeenCalledWith(DB_NAME)
      expect(setItemSpy).toHaveBeenCalledWith(SCHEMA_VERSION_LS_KEY, String(WORLD_SCHEMA_VERSION))
      expect(Option.getOrNull(MutableHashMap.get(store, SCHEMA_VERSION_LS_KEY))).toBe(
        String(WORLD_SCHEMA_VERSION),
      )
    }).pipe(Effect.provide(StorageServiceLive)))

  it.effect('matching version: does NOT trigger wipe', () => {
    MutableHashMap.set(store, SCHEMA_VERSION_LS_KEY, String(WORLD_SCHEMA_VERSION))
    return Effect.gen(function* () {
      const storage = yield* StorageService
      yield* storage.initialize
      expect(deleteDatabaseSpy).not.toHaveBeenCalled()
    }).pipe(Effect.provide(StorageServiceLive))
  })

  it.effect('stale version "2": triggers wipe and writes "3"', () => {
    MutableHashMap.set(store, SCHEMA_VERSION_LS_KEY, '2')
    return Effect.gen(function* () {
      const storage = yield* StorageService
      yield* storage.initialize
      expect(deleteDatabaseSpy).toHaveBeenCalledTimes(1)
      expect(deleteDatabaseSpy).toHaveBeenCalledWith(DB_NAME)
      expect(setItemSpy).toHaveBeenCalledWith(SCHEMA_VERSION_LS_KEY, String(WORLD_SCHEMA_VERSION))
      expect(Option.getOrNull(MutableHashMap.get(store, SCHEMA_VERSION_LS_KEY))).toBe(
        String(WORLD_SCHEMA_VERSION),
      )
    }).pipe(Effect.provide(StorageServiceLive))
  })

  it.effect('deleteDatabase rejects: service still starts (error logged, not propagated)', () => {
    MutableRef.set(deleteBehaviorRef, 'error')
    return Effect.gen(function* () {
      const storage = yield* StorageService
      // initialize must NOT fail even though deleteDatabase rejected.
      yield* storage.initialize
      expect(deleteDatabaseSpy).toHaveBeenCalledTimes(1)
      // When the wipe fails, we deliberately do NOT update the version key —
      // the next startup will retry the wipe rather than silently declaring
      // the DB "upgraded" despite the failure.
      expect(Option.getOrNull(MutableHashMap.get(store, SCHEMA_VERSION_LS_KEY))).toBeNull()
    }).pipe(Effect.provide(StorageServiceLive))
  })
})
