// @effect-boundary IndexedDB is a browser callback/exception API; this module converts it to typed Effect failures.
import { Data, Effect, MutableRef } from 'effect'

// Minimal IndexedDB utility — hand-rolled replacement for the `idb` npm package.
// Provides Effect-based wrappers over the IDBRequest/event API with DBSchema-generic type safety.

export type DBSchema = {
  [storeName: string]: {
    key: IDBValidKey
    value: unknown
  }
}

export type UpgradeDB = {
  readonly objectStoreNames: ReadonlyArray<string>
  createObjectStore(name: string): void
  deleteObjectStore(name: string): void
}

export class IndexedDBError extends Data.TaggedError('IndexedDBError')<{
  readonly message: string
  readonly cause: unknown
}> {}

// Store names and value types are checked against the T schema at compile time.
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
      resume(Effect.fail(new IndexedDBError({ message: 'IndexedDB request failed', cause: req.error ?? undefined })))
    return Effect.sync(() => {
      req.onsuccess = null
      req.onerror = null
    })
  })

const wrapWriteRequest = <T>(tx: IDBTransaction, req: IDBRequest<T>): Effect.Effect<T, IndexedDBError> =>
  Effect.async((resume) => {
    const settledRef = MutableRef.make(false)
    const hasRequestResultRef = MutableRef.make(false)
    const requestResultRef = MutableRef.make<T | undefined>(undefined)

    const settle = (effect: Effect.Effect<T, IndexedDBError>): void => {
      if (MutableRef.get(settledRef)) return
      MutableRef.set(settledRef, true)
      resume(effect)
    }

    const fail = (message: string, cause: unknown): void => {
      settle(Effect.fail(new IndexedDBError({ message, cause })))
    }

    req.onsuccess = () => {
      MutableRef.set(requestResultRef, req.result)
      MutableRef.set(hasRequestResultRef, true)
    }
    req.onerror = () => fail('IndexedDB write request failed', req.error ?? tx.error ?? undefined)
    tx.oncomplete = () => {
      if (!MutableRef.get(hasRequestResultRef)) {
        fail('IndexedDB write transaction completed before request success', undefined)
        return
      }
      settle(Effect.succeed(MutableRef.get(requestResultRef) as T))
    }
    tx.onerror = () => fail('IndexedDB write transaction failed', tx.error ?? req.error ?? undefined)
    tx.onabort = () => fail('IndexedDB write transaction aborted', tx.error ?? req.error ?? undefined)

    return Effect.sync(() => {
      req.onsuccess = null
      req.onerror = null
      tx.oncomplete = null
      tx.onerror = null
      tx.onabort = null
    })
  })

const makeTypedDB = <T extends DBSchema>(db: IDBDatabase): TypedIDBDatabase<T> => ({
  put<S extends Extract<keyof T, string>>(storeName: S, value: T[S]['value'], key?: T[S]['key']) {
    const tx = db.transaction(storeName, 'readwrite')
    const req = key !== undefined ? tx.objectStore(storeName).put(value, key) : tx.objectStore(storeName).put(value)
    return wrapWriteRequest(tx, req)
  },

  get<S extends Extract<keyof T, string>>(storeName: S, key: T[S]['key']) {
    const tx = db.transaction(storeName, 'readonly')
    return wrapRequest(tx.objectStore(storeName).get(key))
  },

  delete<S extends Extract<keyof T, string>>(storeName: S, key: T[S]['key']) {
    const tx = db.transaction(storeName, 'readwrite')
    return wrapWriteRequest(tx, tx.objectStore(storeName).delete(key)).pipe(Effect.asVoid)
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
      } catch (cause) {
        void cause
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
          resume(Effect.fail(new IndexedDBError({ message: 'IndexedDB cursor request failed', cause: req.error ?? undefined })))
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

// Resolves successfully even if the database did not exist. Rejects with IndexedDBError on block or error events.
export const deleteDatabase = (name: string): Effect.Effect<void, IndexedDBError> =>
  Effect.async((resume) => {
    const settledRef = MutableRef.make(false)
    const settle = (effect: Effect.Effect<void, IndexedDBError>): void => {
      if (MutableRef.get(settledRef)) return
      MutableRef.set(settledRef, true)
      resume(effect)
    }
    const req = indexedDB.deleteDatabase(name)
    req.onsuccess = () => settle(Effect.void)
    req.onerror = () =>
      settle(Effect.fail(new IndexedDBError({ message: 'IndexedDB deleteDatabase failed', cause: req.error ?? undefined })))
    req.onblocked = () =>
      settle(Effect.fail(new IndexedDBError({ message: 'IndexedDB deleteDatabase blocked by an existing connection', cause: undefined })))

    return Effect.sync(() => {
      req.onsuccess = null
      req.onerror = null
      req.onblocked = null
    })
  })

// Opens (or creates/upgrades) an IndexedDB database — replaces openDB<T>() from the `idb` package.
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
      resume(Effect.fail(cause instanceof IndexedDBError ? cause : new IndexedDBError({ message: 'IndexedDB open failed', cause })))
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
