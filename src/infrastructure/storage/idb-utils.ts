/**
 * Minimal IndexedDB utility — hand-rolled replacement for the `idb` npm package.
 * Provides Promise-based and async-iterable wrappers over the IDBRequest/event API
 * with DBSchema-generic type safety.
 */

/**
 * Describes the shape of an IndexedDB database.
 * Each key is a store name; the value type describes that store's key/value types.
 */
export interface DBSchema {
  [storeName: string]: {
    key: IDBValidKey
    value: unknown
  }
}

/**
 * Database handle passed to the `upgrade` callback in `openDatabase`.
 * Exposes only the methods needed during schema migrations.
 */
export interface UpgradeDB<T extends DBSchema> {
  readonly objectStoreNames: DOMStringList
  createObjectStore<S extends Extract<keyof T, string>>(name: S): IDBObjectStore
  deleteObjectStore<S extends Extract<keyof T, string>>(name: S): void
}

/**
 * Type-safe database handle returned by `openDatabase`.
 * Store names and value types are checked against the `T` schema.
 */
export interface TypedIDBDatabase<T extends DBSchema> {
  put<S extends Extract<keyof T, string>>(
    storeName: S,
    value: T[S]['value'],
    key?: T[S]['key'],
  ): Promise<IDBValidKey>
  get<S extends Extract<keyof T, string>>(
    storeName: S,
    key: T[S]['key'],
  ): Promise<T[S]['value'] | undefined>
  delete<S extends Extract<keyof T, string>>(storeName: S, key: T[S]['key']): Promise<void>
  openCursor<S extends Extract<keyof T, string>>(storeName: S): AsyncIterable<IDBCursorWithValue>
  close(): void
}

const wrapRequest = <T>(req: IDBRequest<T>): Promise<T> =>
  new Promise<T>((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })

const makeTypedDB = <T extends DBSchema>(db: IDBDatabase): TypedIDBDatabase<T> => ({
  put<S extends Extract<keyof T, string>>(storeName: S, value: T[S]['value'], key?: T[S]['key']) {
    const tx = db.transaction(storeName, 'readwrite')
    const req =
      key !== undefined
        ? tx.objectStore(storeName).put(value, key)
        : tx.objectStore(storeName).put(value)
    return wrapRequest(req)
  },

  get<S extends Extract<keyof T, string>>(storeName: S, key: T[S]['key']) {
    const tx = db.transaction(storeName, 'readonly')
    return wrapRequest(tx.objectStore(storeName).get(key as IDBValidKey)) as Promise<
      T[S]['value'] | undefined
    >
  },

  delete<S extends Extract<keyof T, string>>(storeName: S, key: T[S]['key']) {
    const tx = db.transaction(storeName, 'readwrite')
    return wrapRequest(tx.objectStore(storeName).delete(key as IDBValidKey)) as Promise<void>
  },

  openCursor<S extends Extract<keyof T, string>>(storeName: S): AsyncIterable<IDBCursorWithValue> {
    return {
      [Symbol.asyncIterator]: async function* () {
        const tx = db.transaction(storeName, 'readonly')
        const req = tx.objectStore(storeName).openCursor()

        // cursor.continue() re-fires onsuccess on the original request.
        // We bridge this event-driven API into an async generator via a shared resolve/reject pair.
        let resolve: ((c: IDBCursorWithValue | null) => void) | null = null
        let reject: ((e: unknown) => void) | null = null
        let abandoned = false

        req.onsuccess = () => {
          if (abandoned) return
          if (resolve) {
            resolve(req.result)
            resolve = null
            reject = null
          }
        }

        req.onerror = () => {
          if (abandoned) return
          if (reject) {
            reject(req.error)
            resolve = null
            reject = null
          }
        }

        const waitForNext = (): Promise<IDBCursorWithValue | null> =>
          new Promise((res, rej) => {
            resolve = res
            reject = rej
          })

        try {
          let cursor = await waitForNext()
          while (cursor !== null) {
            yield cursor
            cursor.continue()
            cursor = await waitForNext()
          }
        } finally {
          abandoned = true
          // Abort cleans up any in-flight IDB state on early break or throw.
          // Throws if the transaction already auto-committed (normal completion) — safe to ignore.
          try {
            tx.abort()
          } catch {
            // transaction already completed
          }
        }
      },
    }
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
  upgrade: (db: UpgradeDB<T>, oldVersion: number) => void,
): Promise<TypedIDBDatabase<T>> =>
  new Promise<TypedIDBDatabase<T>>((resolve, reject) => {
    const req = indexedDB.open(name, version)

    req.onupgradeneeded = (event) => {
      upgrade(req.result as unknown as UpgradeDB<T>, event.oldVersion)
    }

    req.onsuccess = () => {
      resolve(makeTypedDB<T>(req.result))
    }

    req.onerror = () => reject(req.error)

    req.onblocked = () =>
      reject(new DOMException('IndexedDB open blocked by an existing connection', 'AbortError'))
  })
