import { Effect, MutableRef } from 'effect'

/**
 * Minimal IndexedDB utility — hand-rolled replacement for the `idb` npm package.
 * Provides Effect-based and async-iterable wrappers over the IDBRequest/event API
 * with DBSchema-generic type safety.
 */

/**
 * Describes the shape of an IndexedDB database.
 * Each key is a store name; the value type describes that store's key/value types.
 */
export type DBSchema = {
  [storeName: string]: {
    key: IDBValidKey
    value: unknown
  }
}

/**
 * Database handle passed to the `upgrade` callback in `openDatabase`.
 * Exposes only the methods needed during schema migrations.
 */
export type UpgradeDB = {
  readonly objectStoreNames: ReadonlyArray<string>
  createObjectStore(name: string): void
  deleteObjectStore(name: string): void
}

export class IndexedDBError extends Error {
  override readonly cause: unknown

  constructor(message: string, cause: unknown) {
    super(message)
    this.name = 'IndexedDBError'
    this.cause = cause
  }
}

/**
 * Type-safe database handle returned by `openDatabase`.
 * Store names and value types are checked against the `T` schema.
 */
export type TypedIDBDatabase<T extends DBSchema> = {
  put<S extends Extract<keyof T, string>>(storeName: S, value: T[S]['value'], key?: T[S]['key']): Effect.Effect<T[S]['key'], IndexedDBError>
  get<S extends Extract<keyof T, string>>(
    storeName: S,
    key: T[S]['key'],
  ): Effect.Effect<T[S]['value'] | undefined, IndexedDBError>
  delete<S extends Extract<keyof T, string>>(storeName: S, key: T[S]['key']): Effect.Effect<void, IndexedDBError>
  forEachCursor<S extends Extract<keyof T, string>>(
    storeName: S,
    onCursor: (cursor: { readonly key: T[S]['key']; readonly value: T[S]['value'] }) => Effect.Effect<void, never>,
  ): Effect.Effect<void, IndexedDBError>
  close(): void
}

const wrapRequest = <T>(req: IDBRequest<T>): Effect.Effect<T, IndexedDBError> =>
  Effect.async((resume) => {
    req.onsuccess = () => resume(Effect.succeed(req.result))
    req.onerror = () =>
      resume(Effect.fail(new IndexedDBError('IndexedDB request failed', req.error ?? undefined)))
    return Effect.sync(() => {
      req.onsuccess = null
      req.onerror = null
    })
  })

const makeTypedDB = <T extends DBSchema>(db: IDBDatabase): TypedIDBDatabase<T> => ({
  put<S extends Extract<keyof T, string>>(storeName: S, value: T[S]['value'], key?: T[S]['key']) {
    const tx = db.transaction(storeName, 'readwrite')
    const req = key !== undefined ? tx.objectStore(storeName).put(value, key) : tx.objectStore(storeName).put(value)
    return wrapRequest(req)
  },

  get<S extends Extract<keyof T, string>>(storeName: S, key: T[S]['key']) {
    const tx = db.transaction(storeName, 'readonly')
    return wrapRequest(tx.objectStore(storeName).get(key))
  },

  delete<S extends Extract<keyof T, string>>(storeName: S, key: T[S]['key']) {
    const tx = db.transaction(storeName, 'readwrite')
    return wrapRequest(tx.objectStore(storeName).delete(key)).pipe(Effect.asVoid)
  },

  forEachCursor<S extends Extract<keyof T, string>>(
    storeName: S,
    onCursor: (cursor: { readonly key: T[S]['key']; readonly value: T[S]['value'] }) => Effect.Effect<void, never>,
  ): Effect.Effect<void, IndexedDBError> {
    const tx = db.transaction(storeName, 'readonly')
    const req = tx.objectStore(storeName).openCursor()

    // cursor.continue() re-fires onsuccess on the original request.
    // We bridge this event-driven API into Effect by re-arming the request listener per iteration.
    const abandonedRef = MutableRef.make(false)

    const cleanup = (): void => {
      if (MutableRef.get(abandonedRef)) return
      MutableRef.set(abandonedRef, true)
      // Abort cleans up any in-flight IDB state on early break or throw.
      // Throws if the transaction already auto-committed (normal completion) — safe to ignore.
      try {
        tx.abort()
      } catch (_cause) {
        // transaction already completed
      }
    }

    const waitForNext = (): Effect.Effect<IDBCursorWithValue | null, IndexedDBError> =>
      Effect.async((resume) => {
        req.onsuccess = () => {
          if (MutableRef.get(abandonedRef)) return
          resume(Effect.succeed(req.result))
        }
        req.onerror = () => {
          if (MutableRef.get(abandonedRef)) return
          resume(Effect.fail(new IndexedDBError('IndexedDB cursor request failed', req.error ?? undefined)))
        }
        return Effect.sync(() => {
          req.onsuccess = null
          req.onerror = null
        })
      })

    return Effect.gen(function* () {
      while (true) {
        const cursor = yield* waitForNext()
        if (cursor === null) {
          cleanup()
          return
        }

        yield* onCursor({ key: cursor.key, value: cursor.value })
        cursor.continue()
      }
    }).pipe(
      Effect.ensuring(Effect.sync(cleanup))
    )
  },

  close() {
    db.close()
  },
})

/**
 * Opens (or creates/upgrades) an IndexedDB database.
 * Replaces `openDB<T>()` from the `idb` package.
 */
export const openDatabase = <T extends DBSchema>(
  name: string,
  version: number,
  upgrade: (db: UpgradeDB, oldVersion: number) => void,
): Effect.Effect<TypedIDBDatabase<T>, IndexedDBError> =>
  Effect.async((resume) => {
    const settledRef = MutableRef.make(false)
    const markSettled = (): void => {
      MutableRef.set(settledRef, true)
    }
    const isSettled = (): boolean => MutableRef.get(settledRef)
    const req = indexedDB.open(name, version)

    const fail = (cause: unknown): void => {
      if (isSettled()) return
      markSettled()
      resume(Effect.fail(cause instanceof IndexedDBError ? cause : new IndexedDBError('IndexedDB open failed', cause)))
    }

    req.onupgradeneeded = (event) => {
      try {
        const db: UpgradeDB = {
          objectStoreNames: Array.from(req.result.objectStoreNames),
          createObjectStore: (storeName) => {
            req.result.createObjectStore(storeName)
          },
          deleteObjectStore: (storeName) => {
            req.result.deleteObjectStore(storeName)
          },
        }
        upgrade(db, event.oldVersion)
      } catch (cause) {
        fail(cause)
      }
    }

    req.onsuccess = () => {
      if (isSettled()) return
      markSettled()
      resume(Effect.succeed(makeTypedDB<T>(req.result)))
    }

    req.onerror = () => fail(req.error ?? new DOMException('IndexedDB open failed', 'AbortError'))
    req.onblocked = () => fail(new DOMException('IndexedDB open blocked by an existing connection', 'AbortError'))

    return Effect.sync(() => {
      req.onupgradeneeded = null
      req.onsuccess = null
      req.onerror = null
      req.onblocked = null
    })
  })
