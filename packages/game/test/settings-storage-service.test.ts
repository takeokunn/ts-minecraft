import { describe, it } from '@effect/vitest'
import { Effect, Either } from 'effect'
import { afterEach, expect, vi } from 'vitest'
import { SettingsError, SettingsStoragePort, SettingsStorageServiceLayer } from '@ts-minecraft/game'

type RequestFixture<T> = {
  result: T
  error: DOMException | null
  onsuccess: ((this: IDBRequest<T>, ev: Event) => unknown) | null
  onerror: ((this: IDBRequest<T>, ev: Event) => unknown) | null
}

type OpenRequestFixture = RequestFixture<IDBDatabase> & {
  onblocked: ((this: IDBOpenDBRequest, ev: Event) => unknown) | null
  onupgradeneeded: ((this: IDBOpenDBRequest, ev: IDBVersionChangeEvent) => unknown) | null
}

type TransactionFixture = {
  error: DOMException | null
  oncomplete: ((this: IDBTransaction, ev: Event) => unknown) | null
  onerror: ((this: IDBTransaction, ev: Event) => unknown) | null
  onabort: ((this: IDBTransaction, ev: Event) => unknown) | null
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

const waitForCondition = async (condition: () => boolean, message: string): Promise<void> => {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (condition()) return
    await Promise.resolve()
  }

  throw new Error(message)
}

const installDeferredSettingsIndexedDb = () => {
  const putRequest = makeRequest<IDBValidKey>('current')
  const objectStore = {
    put: vi.fn((_value: unknown, _key: IDBValidKey) => putRequest as unknown as IDBRequest<IDBValidKey>),
  }
  const transaction: TransactionFixture = {
    error: null,
    oncomplete: null,
    onerror: null,
    onabort: null,
    objectStore: vi.fn(() => objectStore as unknown as IDBObjectStore),
  }
  const database = {
    objectStoreNames: {
      contains: (name: string) => name === 'settings',
    },
    createObjectStore: vi.fn(),
    transaction: vi.fn(() => transaction as unknown as IDBTransaction),
    close: vi.fn(),
  } as unknown as IDBDatabase
  const openRequest: OpenRequestFixture = {
    ...makeRequest<IDBDatabase>(database),
    onblocked: null,
    onupgradeneeded: null,
  }

  Object.defineProperty(globalThis, 'indexedDB', {
    configurable: true,
    value: {
      open: vi.fn(() => openRequest as unknown as IDBOpenDBRequest),
    },
  })

  return { openRequest, putRequest, transaction }
}

describe('infrastructure/settings-storage-service', () => {
  it('waits for the save transaction to complete before succeeding', async () => {
    const { openRequest, putRequest, transaction } = installDeferredSettingsIndexedDb()
    const settled = vi.fn()

    const savePromise = Effect.runPromise(
      Effect.gen(function* () {
        const storage = yield* SettingsStoragePort
        yield* storage.saveSettings({ renderDistance: 12 })
      }).pipe(Effect.provide(SettingsStorageServiceLayer)),
    ).then(() => {
      settled()
    })

    await waitForCondition(() => openRequest.onsuccess !== null, 'open success handler was not registered')
    openRequest.onsuccess?.call(openRequest as unknown as IDBRequest<IDBDatabase>, new Event('success'))
    await waitForCondition(() => putRequest.onsuccess !== null, 'put success handler was not registered')
    putRequest.onsuccess?.call(putRequest as unknown as IDBRequest<IDBValidKey>, new Event('success'))
    await waitForCondition(() => transaction.oncomplete !== null, 'transaction complete handler was not registered')

    expect(settled).not.toHaveBeenCalled()

    transaction.oncomplete?.call(transaction as unknown as IDBTransaction, new Event('complete'))

    await expect(savePromise).resolves.toBeUndefined()
    expect(settled).toHaveBeenCalledOnce()
  })

  it('fails save when the transaction aborts after put request success', async () => {
    const { openRequest, putRequest, transaction } = installDeferredSettingsIndexedDb()
    const abortCause = new DOMException('commit failed', 'AbortError')
    const saveResultPromise = Effect.runPromise(
      Effect.either(
        Effect.gen(function* () {
          const storage = yield* SettingsStoragePort
          yield* storage.saveSettings({ renderDistance: 12 })
        }).pipe(Effect.provide(SettingsStorageServiceLayer)),
      ),
    )

    await waitForCondition(() => openRequest.onsuccess !== null, 'open success handler was not registered')
    openRequest.onsuccess?.call(openRequest as unknown as IDBRequest<IDBDatabase>, new Event('success'))
    await waitForCondition(() => putRequest.onsuccess !== null, 'put success handler was not registered')
    putRequest.onsuccess?.call(putRequest as unknown as IDBRequest<IDBValidKey>, new Event('success'))
    await waitForCondition(() => transaction.onabort !== null, 'transaction abort handler was not registered')
    transaction.error = abortCause
    transaction.onabort?.call(transaction as unknown as IDBTransaction, new Event('abort'))

    const result = await saveResultPromise
    if (Either.isRight(result)) {
      expect.fail('save unexpectedly succeeded after transaction abort')
    }

    expect(result.left).toMatchObject({
      _tag: 'SettingsError',
      operation: 'save',
      cause: abortCause,
    } satisfies Partial<SettingsError>)
  })
})
