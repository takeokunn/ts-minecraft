import { Effect, Layer, Option, Ref } from 'effect'
import { SettingsError } from '../domain/errors'
import { SettingsStoragePort } from '../domain/settings-storage-port'

const SETTINGS_DB_NAME = 'minecraft-settings'
const SETTINGS_DB_VERSION = 1
const SETTINGS_STORE_NAME = 'settings'
const SETTINGS_RECORD_KEY = 'current'

const effectFromCallback: typeof Effect.async = Effect.async

const requestEffect = <A>(request: IDBRequest<A>, operation: SettingsError['operation']): Effect.Effect<A, SettingsError> =>
  effectFromCallback<A, SettingsError>((resume) => {
    request.onsuccess = () => resume(Effect.succeed(request.result))
    request.onerror = () => resume(Effect.fail(new SettingsError({ operation, cause: request.error ?? undefined })))
    return Effect.sync(() => {
      request.onsuccess = null
      request.onerror = null
    })
  })

const writeRequestEffect = <A>(
  transaction: IDBTransaction,
  request: IDBRequest<A>,
  operation: SettingsError['operation'],
): Effect.Effect<A, SettingsError> =>
  effectFromCallback<A, SettingsError>((resume) => {
    let settled = false
    let hasRequestResult = false
    let requestResult: A | undefined

    const settle = (effect: Effect.Effect<A, SettingsError>): void => {
      if (settled) return
      settled = true
      resume(effect)
    }

    const fail = (cause: unknown): void => {
      settle(Effect.fail(new SettingsError({ operation, cause })))
    }

    request.onsuccess = () => {
      requestResult = request.result
      hasRequestResult = true
    }
    request.onerror = () => fail(request.error ?? transaction.error ?? undefined)
    transaction.oncomplete = () => {
      if (!hasRequestResult) {
        fail(new Error('IndexedDB write transaction completed before request success'))
        return
      }
      settle(Effect.succeed(requestResult as A))
    }
    transaction.onerror = () => fail(transaction.error ?? request.error ?? undefined)
    transaction.onabort = () => fail(transaction.error ?? request.error ?? undefined)

    return Effect.sync(() => {
      request.onsuccess = null
      request.onerror = null
      transaction.oncomplete = null
      transaction.onerror = null
      transaction.onabort = null
    })
  })

const openSettingsDatabase = (operation: SettingsError['operation']): Effect.Effect<IDBDatabase, SettingsError> =>
  Effect.gen(function* () {
    if (typeof indexedDB === 'undefined') {
      return yield* Effect.fail(new SettingsError({ operation, cause: new Error('IndexedDB is unavailable') }))
    }

    const request = yield* Effect.try({
      try: () => indexedDB.open(SETTINGS_DB_NAME, SETTINGS_DB_VERSION),
      catch: (cause) => new SettingsError({ operation, cause }),
    })

    return yield* effectFromCallback<IDBDatabase, SettingsError>((resume) => {
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(SETTINGS_STORE_NAME)) {
          request.result.createObjectStore(SETTINGS_STORE_NAME)
        }
      }
      request.onsuccess = () => resume(Effect.succeed(request.result))
      request.onerror = () => resume(Effect.fail(new SettingsError({ operation, cause: request.error ?? undefined })))
      request.onblocked = () => resume(Effect.fail(new SettingsError({ operation, cause: new Error('IndexedDB open blocked') })))

      return Effect.sync(() => {
        request.onupgradeneeded = null
        request.onsuccess = null
        request.onerror = null
        request.onblocked = null
      })
    })
  })

const withSettingsDatabase = <A>(
  dbRef: Ref.Ref<Option.Option<IDBDatabase>>,
  operation: SettingsError['operation'],
  effect: (db: IDBDatabase) => Effect.Effect<A, SettingsError>,
): Effect.Effect<A, SettingsError> =>
  Effect.gen(function* () {
    const db = Option.getOrNull(yield* Ref.get(dbRef))
    if (db === null) {
      return yield* Effect.fail(new SettingsError({ operation, cause: new Error('Database not initialized') }))
    }
    return yield* effect(db)
  })

export const SettingsStorageServiceLayer = Layer.effect(
  SettingsStoragePort,
  Effect.gen(function* () {
    const dbRef = yield* Ref.make<Option.Option<IDBDatabase>>(Option.none())

    const initialize = (operation: SettingsError['operation']) =>
      Effect.gen(function* () {
        const existingDb = yield* Ref.get(dbRef)
        if (Option.isNone(existingDb)) {
          const newDb = yield* openSettingsDatabase(operation)
          yield* Ref.set(dbRef, Option.some(newDb))
        }
      })

    return SettingsStoragePort.of({
      _tag: '@minecraft/application/SettingsStoragePort' as const,
      loadSettings: () =>
        Effect.gen(function* () {
          yield* initialize('load')
          return yield* withSettingsDatabase(dbRef, 'load', (db) =>
            Effect.gen(function* () {
              const raw = yield* requestEffect(db.transaction(SETTINGS_STORE_NAME, 'readonly').objectStore(SETTINGS_STORE_NAME).get(SETTINGS_RECORD_KEY), 'load')
              return Option.fromNullable(raw)
            })
          )
        }),
      saveSettings: (settings: unknown) =>
        Effect.gen(function* () {
          yield* initialize('save')
          yield* withSettingsDatabase(dbRef, 'save', (db) =>
            Effect.gen(function* () {
              const transaction = db.transaction(SETTINGS_STORE_NAME, 'readwrite')
              yield* writeRequestEffect(
                transaction,
                transaction.objectStore(SETTINGS_STORE_NAME).put(settings, SETTINGS_RECORD_KEY),
                'save',
              ).pipe(Effect.asVoid)
            })
          )
        }),
    })
  }),
)
