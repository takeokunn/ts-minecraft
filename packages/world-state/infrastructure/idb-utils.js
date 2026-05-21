import { Effect, MutableRef } from 'effect';
export class IndexedDBError extends Error {
    cause;
    constructor(message, cause) {
        super(message);
        this.name = 'IndexedDBError';
        this.cause = cause;
    }
}
const wrapRequest = (req) => Effect.async((resume) => {
    req.onsuccess = () => resume(Effect.succeed(req.result));
    req.onerror = () => resume(Effect.fail(new IndexedDBError('IndexedDB request failed', req.error ?? undefined)));
    return Effect.sync(() => {
        req.onsuccess = null;
        req.onerror = null;
    });
});
const makeTypedDB = (db) => ({
    put(storeName, value, key) {
        const tx = db.transaction(storeName, 'readwrite');
        const req = key !== undefined ? tx.objectStore(storeName).put(value, key) : tx.objectStore(storeName).put(value);
        return wrapRequest(req);
    },
    get(storeName, key) {
        const tx = db.transaction(storeName, 'readonly');
        return wrapRequest(tx.objectStore(storeName).get(key));
    },
    delete(storeName, key) {
        const tx = db.transaction(storeName, 'readwrite');
        return wrapRequest(tx.objectStore(storeName).delete(key)).pipe(Effect.asVoid);
    },
    forEachCursor(storeName, onCursor) {
        const tx = db.transaction(storeName, 'readonly');
        const req = tx.objectStore(storeName).openCursor();
        // cursor.continue() re-fires onsuccess on the original request.
        // We bridge this event-driven API into Effect by re-arming the request listener per iteration.
        const abandonedRef = MutableRef.make(false);
        const cleanup = () => {
            if (MutableRef.get(abandonedRef))
                return;
            MutableRef.set(abandonedRef, true);
            // Abort cleans up any in-flight IDB state on early break or throw.
            // Throws if the transaction already auto-committed (normal completion) — safe to ignore.
            try {
                tx.abort();
            }
            catch (cause) {
                void cause;
            }
        };
        const waitForNext = () => Effect.async((resume) => {
            req.onsuccess = () => {
                if (MutableRef.get(abandonedRef))
                    return;
                resume(Effect.succeed(req.result));
            };
            req.onerror = () => {
                if (MutableRef.get(abandonedRef))
                    return;
                resume(Effect.fail(new IndexedDBError('IndexedDB cursor request failed', req.error ?? undefined)));
            };
            return Effect.sync(() => {
                req.onsuccess = null;
                req.onerror = null;
            });
        });
        return Effect.gen(function* () {
            while (true) {
                const cursor = yield* waitForNext();
                if (cursor === null) {
                    cleanup();
                    return;
                }
                yield* onCursor({ key: cursor.key, value: cursor.value });
                cursor.continue();
            }
        }).pipe(Effect.ensuring(Effect.sync(cleanup)));
    },
    close() {
        db.close();
    },
});
// Resolves successfully even if the database did not exist. Rejects with IndexedDBError on block or error events.
export const deleteDatabase = (name) => Effect.async((resume) => {
    const settledRef = MutableRef.make(false);
    const settle = (effect) => {
        if (MutableRef.get(settledRef))
            return;
        MutableRef.set(settledRef, true);
        resume(effect);
    };
    const req = indexedDB.deleteDatabase(name);
    req.onsuccess = () => settle(Effect.void);
    req.onerror = () => settle(Effect.fail(new IndexedDBError('IndexedDB deleteDatabase failed', req.error ?? undefined)));
    req.onblocked = () => settle(Effect.fail(new IndexedDBError('IndexedDB deleteDatabase blocked by an existing connection', undefined)));
    return Effect.sync(() => {
        req.onsuccess = null;
        req.onerror = null;
        req.onblocked = null;
    });
});
// Opens (or creates/upgrades) an IndexedDB database — replaces openDB<T>() from the `idb` package.
export const openDatabase = (name, version, upgrade) => Effect.async((resume) => {
    const settledRef = MutableRef.make(false);
    const markSettled = () => {
        MutableRef.set(settledRef, true);
    };
    const isSettled = () => MutableRef.get(settledRef);
    const req = indexedDB.open(name, version);
    const fail = (cause) => {
        if (isSettled())
            return;
        markSettled();
        resume(Effect.fail(cause instanceof IndexedDBError ? cause : new IndexedDBError('IndexedDB open failed', cause)));
    };
    req.onupgradeneeded = (event) => {
        try {
            const db = {
                objectStoreNames: Array.from(req.result.objectStoreNames),
                createObjectStore: (storeName) => {
                    req.result.createObjectStore(storeName);
                },
                deleteObjectStore: (storeName) => {
                    req.result.deleteObjectStore(storeName);
                },
            };
            upgrade(db, event.oldVersion);
        }
        catch (cause) {
            fail(cause);
        }
    };
    req.onsuccess = () => {
        if (isSettled())
            return;
        markSettled();
        resume(Effect.succeed(makeTypedDB(req.result)));
    };
    req.onerror = () => fail(req.error ?? new DOMException('IndexedDB open failed', 'AbortError'));
    req.onblocked = () => fail(new DOMException('IndexedDB open blocked by an existing connection', 'AbortError'));
    return Effect.sync(() => {
        req.onupgradeneeded = null;
        req.onsuccess = null;
        req.onerror = null;
        req.onblocked = null;
    });
});
//# sourceMappingURL=../../../dist/packages/world-state/infrastructure/idb-utils.js.map