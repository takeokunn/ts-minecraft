import { describe, it } from '@effect/vitest'
import { afterEach, expect, vi } from 'vitest'
import { Effect, Either } from 'effect'
import { IndexedDBError, openDatabase, type DBSchema } from '../infrastructure/idb-utils'

interface TestDBSchema extends DBSchema {
  records: {
    key: string
    value: { readonly id: string }
  }
}

type RequestFixture<T> = {
  result: T
  error: DOMException | null
  onsuccess: ((this: IDBRequest<T>, ev: Event) => unknown) | null
  onerror: ((this: IDBRequest<T>, ev: Event) => unknown) | null
}

type OpenRequestFixture = {
  result: IDBDatabase
  error: DOMException | null
  onsuccess: ((this: IDBRequest<IDBDatabase>, ev: Event) => unknown) | null
  onerror: ((this: IDBRequest<IDBDatabase>, ev: Event) => unknown) | null
  onblocked: ((this: IDBOpenDBRequest, ev: Event) => unknown) | null
  onupgradeneeded: ((this: IDBOpenDBRequest, ev: IDBVersionChangeEvent) => unknown) | null
}

type TransactionFixture = {
  error: DOMException | null
  oncomplete: ((this: IDBTransaction, ev: Event) => unknown) | null
  onerror: ((this: IDBTransaction, ev: Event) => unknown) | null
  onabort: ((this: IDBTransaction, ev: Event) => unknown) | null
  abort: () => void
  objectStore: () => IDBObjectStore
}

const originalIndexedDBDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'indexedDB')

afterEach(() => {
  if (originalIndexedDBDescriptor) {
    Object.defineProperty(globalThis, 'indexedDB', originalIndexedDBDescriptor)
    return
  }

  Reflect.deleteProperty(globalThis, 'indexedDB')
})

const makeRequest = <T>(result: T): RequestFixture<T> => ({
  result,
  error: null,
  onsuccess: null,
  onerror: null,
})

const makeOpenRequest = (database: IDBDatabase): OpenRequestFixture => ({
  result: database,
  error: null,
  onsuccess: null,
  onerror: null,
  onblocked: null,
  onupgradeneeded: null,
})

const installIndexedDBOpen = (database: IDBDatabase): OpenRequestFixture => {
  const openRequest = makeOpenRequest(database)
  Object.defineProperty(globalThis, 'indexedDB', {
    configurable: true,
    value: {
      open: vi.fn(() => openRequest as unknown as IDBOpenDBRequest),
    },
  })
  return openRequest
}

const openTypedDatabase = async (database: IDBDatabase) => {
  const openRequest = installIndexedDBOpen(database)
  const databasePromise = Effect.runPromise(openDatabase<TestDBSchema>('test-db', 1, () => {}))

  openRequest.onsuccess?.call(openRequest as unknown as IDBRequest<IDBDatabase>, new Event('success'))

  return databasePromise
}

const makePutDatabase = (request: RequestFixture<IDBValidKey>) => {
  const objectStore = {
    put: vi.fn((_value: unknown, _key?: IDBValidKey) => request as unknown as IDBRequest<IDBValidKey>),
  }
  const transaction: TransactionFixture = {
    error: null,
    oncomplete: null,
    onerror: null,
    onabort: null,
    abort: vi.fn(),
    objectStore: vi.fn(() => objectStore as unknown as IDBObjectStore),
  }
  const database = {
    transaction: vi.fn(() => transaction as unknown as IDBTransaction),
    close: vi.fn(),
  } as unknown as IDBDatabase

  return { database, transaction }
}

const makeDeleteDatabase = (request: RequestFixture<undefined>) => {
  const objectStore = {
    delete: vi.fn((_key: IDBValidKey) => request as unknown as IDBRequest<undefined>),
  }
  const transaction: TransactionFixture = {
    error: null,
    oncomplete: null,
    onerror: null,
    onabort: null,
    abort: vi.fn(),
    objectStore: vi.fn(() => objectStore as unknown as IDBObjectStore),
  }
  const database = {
    transaction: vi.fn(() => transaction as unknown as IDBTransaction),
    close: vi.fn(),
  } as unknown as IDBDatabase

  return { database, transaction }
}

describe('infrastructure/storage/idb-utils', () => {
  it('waits for the write transaction to complete before resolving put', async () => {
    const putRequest = makeRequest<IDBValidKey>('record-1')
    const { database, transaction } = makePutDatabase(putRequest)
    const db = await openTypedDatabase(database)
    const settled = vi.fn()

    const putPromise = Effect.runPromise(db.put('records', { id: 'record-1' }, 'record-1')).then((result) => {
      settled()
      return result
    })

    putRequest.onsuccess?.call(putRequest as unknown as IDBRequest<IDBValidKey>, new Event('success'))
    await Promise.resolve()

    expect(settled).not.toHaveBeenCalled()

    transaction.oncomplete?.call(transaction as unknown as IDBTransaction, new Event('complete'))

    await expect(putPromise).resolves.toBe('record-1')
    expect(settled).toHaveBeenCalledOnce()
  })

  it('fails put when the write transaction aborts after request success', async () => {
    const putRequest = makeRequest<IDBValidKey>('record-1')
    const { database, transaction } = makePutDatabase(putRequest)
    const db = await openTypedDatabase(database)
    const abortCause = new DOMException('commit failed', 'AbortError')
    const putResultPromise = Effect.runPromise(Effect.either(db.put('records', { id: 'record-1' }, 'record-1')))

    putRequest.onsuccess?.call(putRequest as unknown as IDBRequest<IDBValidKey>, new Event('success'))
    transaction.error = abortCause
    transaction.onabort?.call(transaction as unknown as IDBTransaction, new Event('abort'))

    const result = await putResultPromise
    if (Either.isRight(result)) {
      expect.fail('put unexpectedly succeeded after transaction abort')
    }

    expect(result.left).toMatchObject({
      _tag: 'IndexedDBError',
      cause: abortCause,
      message: 'IndexedDB write transaction aborted',
    } satisfies Partial<IndexedDBError>)
  })

  it('waits for the write transaction to complete before resolving delete', async () => {
    const deleteRequest = makeRequest<undefined>(undefined)
    const { database, transaction } = makeDeleteDatabase(deleteRequest)
    const db = await openTypedDatabase(database)
    const settled = vi.fn()

    const deletePromise = Effect.runPromise(db.delete('records', 'record-1')).then(() => {
      settled()
    })

    deleteRequest.onsuccess?.call(deleteRequest as unknown as IDBRequest<undefined>, new Event('success'))
    await Promise.resolve()

    expect(settled).not.toHaveBeenCalled()

    transaction.oncomplete?.call(transaction as unknown as IDBTransaction, new Event('complete'))

    await expect(deletePromise).resolves.toBeUndefined()
    expect(settled).toHaveBeenCalledOnce()
  })
})
