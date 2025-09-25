/**
 * InventoryStorageService - データ永続化サービス
 *
 * LocalStorageとIndexedDBを使用したInventoryデータの永続化を提供
 * Zustand persistとの統合も含む
 */

import { Context, Effect, Layer, Match, Option, pipe } from 'effect'
import { Schema } from '@effect/schema'
import { Inventory, InventoryState, PlayerId, validateInventoryState } from './InventoryTypes.js'

// Storage configuration schema
export const StorageConfig = Schema.Struct({
  storageType: Schema.Literal('localStorage', 'indexedDB', 'both'),
  autoSave: Schema.Boolean,
  saveInterval: Schema.Number.pipe(Schema.positive()), // milliseconds
  backupCount: Schema.Number.pipe(Schema.between(1, 10)),
  compressionEnabled: Schema.Boolean,
})
export type StorageConfig = Schema.Schema.Type<typeof StorageConfig>

// Storage errors
export class StorageError extends Error {
  readonly _tag = 'StorageError'
  constructor(
    readonly reason: 'STORAGE_NOT_AVAILABLE' | 'SAVE_FAILED' | 'LOAD_FAILED' | 'CORRUPTION_DETECTED' | 'QUOTA_EXCEEDED',
    readonly details?: unknown
  ) {
    super(`Storage error: ${reason}`)
  }
}

// Storage service interface
export interface InventoryStorageService {
  readonly saveInventory: (playerId: PlayerId, inventory: Inventory) => Effect.Effect<void, StorageError>
  readonly loadInventory: (playerId: PlayerId) => Effect.Effect<Option.Option<Inventory>, StorageError>
  readonly saveInventoryState: (state: InventoryState) => Effect.Effect<void, StorageError>
  readonly loadInventoryState: (playerId: PlayerId) => Effect.Effect<Option.Option<InventoryState>, StorageError>
  readonly deleteInventory: (playerId: PlayerId) => Effect.Effect<void, StorageError>
  readonly listStoredInventories: () => Effect.Effect<PlayerId[], StorageError>
  readonly createBackup: (playerId: PlayerId) => Effect.Effect<string, StorageError> // returns backup id
  readonly restoreBackup: (playerId: PlayerId, backupId: string) => Effect.Effect<Inventory, StorageError>
  readonly clearAllData: () => Effect.Effect<void, StorageError>
  readonly getStorageInfo: () => Effect.Effect<
    {
      totalSize: number
      availableSpace: number
      itemCount: number
    },
    StorageError
  >
}

// Context tag
export const InventoryStorageService = Context.GenericTag<InventoryStorageService>('@minecraft/InventoryStorageService')

// LocalStorage implementation
export const LocalStorageInventoryService = Layer.effect(
  InventoryStorageService,
  Effect.gen(function* () {
    const STORAGE_PREFIX = 'minecraft:inventory:'
    const BACKUP_PREFIX = 'minecraft:inventory:backup:'
    const STATE_PREFIX = 'minecraft:inventory:state:'

    const generateStorageKey = (playerId: PlayerId): string => `${STORAGE_PREFIX}${playerId}`

    const generateBackupKey = (playerId: PlayerId, backupId: string): string =>
      `${BACKUP_PREFIX}${playerId}:${backupId}`

    const generateStateKey = (playerId: PlayerId): string => `${STATE_PREFIX}${playerId}`

    const isLocalStorageAvailable = (): boolean => {
      try {
        const test = '__localStorage_test__'
        localStorage.setItem(test, 'test')
        localStorage.removeItem(test)
        return true
      } catch {
        return false
      }
    }

    return InventoryStorageService.of({
      saveInventory: (playerId: PlayerId, inventory: Inventory) =>
        Effect.gen(function* () {
          yield* pipe(
            Match.value(isLocalStorageAvailable()),
            Match.when(false, () => Effect.fail(new StorageError('STORAGE_NOT_AVAILABLE'))),
            Match.when(true, () =>
              Effect.try({
                try: () => {
                  const key = generateStorageKey(playerId)
                  const data = JSON.stringify(inventory)
                  localStorage.setItem(key, data)
                },
                catch: (error) => new StorageError('SAVE_FAILED', error),
              })
            ),
            Match.exhaustive
          )
        }),

      loadInventory: (playerId: PlayerId) =>
        Effect.gen(function* () {
          return yield* pipe(
            Match.value(isLocalStorageAvailable()),
            Match.when(false, () => Effect.fail(new StorageError('STORAGE_NOT_AVAILABLE'))),
            Match.when(true, () =>
              Effect.try({
                try: () => {
                  const key = generateStorageKey(playerId)
                  const data = localStorage.getItem(key)

                  return pipe(
                    Option.fromNullable(data),
                    Option.map((jsonData) => JSON.parse(jsonData) as Inventory)
                  )
                },
                catch: (error) => new StorageError('LOAD_FAILED', error),
              })
            ),
            Match.exhaustive
          )
        }),

      saveInventoryState: (state: InventoryState) =>
        Effect.gen(function* () {
          // Validate state before saving
          yield* pipe(
            validateInventoryState(state),
            Effect.mapError((error) => new StorageError('SAVE_FAILED', { reason: 'Invalid state', error }))
          )

          yield* pipe(
            Match.value(isLocalStorageAvailable()),
            Match.when(false, () => Effect.fail(new StorageError('STORAGE_NOT_AVAILABLE'))),
            Match.when(true, () =>
              Effect.try({
                try: () => {
                  const key = generateStateKey(state.inventory.playerId)
                  const data = JSON.stringify(state)
                  localStorage.setItem(key, data)
                },
                catch: (error) => new StorageError('SAVE_FAILED', error),
              })
            ),
            Match.exhaustive
          )
        }),

      loadInventoryState: (playerId: PlayerId) =>
        Effect.gen(function* () {
          return yield* pipe(
            Match.value(isLocalStorageAvailable()),
            Match.when(false, () => Effect.fail(new StorageError('STORAGE_NOT_AVAILABLE'))),
            Match.when(true, () =>
              Effect.try({
                try: () => {
                  const key = generateStateKey(playerId)
                  const data = localStorage.getItem(key)

                  return pipe(
                    Option.fromNullable(data),
                    Option.map((jsonData) => JSON.parse(jsonData) as InventoryState)
                  )
                },
                catch: (error) => new StorageError('LOAD_FAILED', error),
              })
            ),
            Match.exhaustive
          )
        }),

      deleteInventory: (playerId: PlayerId) =>
        Effect.gen(function* () {
          yield* Effect.try({
            try: () => {
              const inventoryKey = generateStorageKey(playerId)
              const stateKey = generateStateKey(playerId)
              localStorage.removeItem(inventoryKey)
              localStorage.removeItem(stateKey)
            },
            catch: (error) => new StorageError('SAVE_FAILED', error),
          })
        }),

      listStoredInventories: () =>
        Effect.gen(function* () {
          return yield* Effect.try({
            try: () => {
              const playerIds: PlayerId[] = []

              for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i)

                pipe(
                  Option.fromNullable(key),
                  Option.filter((k) => k.startsWith(STORAGE_PREFIX)),
                  Option.map((k) => k.replace(STORAGE_PREFIX, '') as PlayerId),
                  Option.match({
                    onNone: () => {},
                    onSome: (playerId) => playerIds.push(playerId),
                  })
                )
              }

              return playerIds
            },
            catch: (error) => new StorageError('LOAD_FAILED', error),
          })
        }),

      createBackup: (playerId: PlayerId) =>
        Effect.gen(function* () {
          const inventoryOption = yield* Effect.try({
            try: () => {
              const key = generateStorageKey(playerId)
              const data = localStorage.getItem(key)

              return pipe(
                Option.fromNullable(data),
                Option.map((jsonData) => JSON.parse(jsonData) as Inventory)
              )
            },
            catch: (error) => new StorageError('LOAD_FAILED', error),
          })

          const inventory = yield* pipe(
            inventoryOption,
            Option.match({
              onNone: () => Effect.fail(new StorageError('LOAD_FAILED', { reason: 'Inventory not found' })),
              onSome: (inv) => Effect.succeed(inv),
            })
          )

          const backupId = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
          const backupKey = generateBackupKey(playerId, backupId)

          yield* Effect.try({
            try: () => {
              const backupData = {
                timestamp: Date.now(),
                inventory,
                version: '1.0.0',
              }
              localStorage.setItem(backupKey, JSON.stringify(backupData))
            },
            catch: (error) => new StorageError('SAVE_FAILED', error),
          })

          return backupId
        }),

      restoreBackup: (playerId: PlayerId, backupId: string) =>
        Effect.gen(function* () {
          const backupKey = generateBackupKey(playerId, backupId)

          const backupData = yield* Effect.try({
            try: () => {
              const data = localStorage.getItem(backupKey)
              return pipe(
                Option.fromNullable(data),
                Option.match({
                  onNone: () => null,
                  onSome: (jsonData) => JSON.parse(jsonData),
                })
              )
            },
            catch: (error) => new StorageError('LOAD_FAILED', error),
          })

          return yield* pipe(
            Option.fromNullable(backupData),
            Option.match({
              onNone: () => Effect.fail(new StorageError('LOAD_FAILED', { reason: 'Backup not found' })),
              onSome: (data) => Effect.succeed(data.inventory as Inventory),
            })
          )
        }),

      clearAllData: () =>
        Effect.gen(function* () {
          yield* Effect.try({
            try: () => {
              const keysToRemove: string[] = []

              for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i)

                pipe(
                  Option.fromNullable(key),
                  Option.filter(
                    (k) => k.startsWith(STORAGE_PREFIX) || k.startsWith(BACKUP_PREFIX) || k.startsWith(STATE_PREFIX)
                  ),
                  Option.match({
                    onNone: () => {},
                    onSome: (k) => keysToRemove.push(k),
                  })
                )
              }

              keysToRemove.forEach((key) => localStorage.removeItem(key))
            },
            catch: (error) => new StorageError('SAVE_FAILED', error),
          })
        }),

      getStorageInfo: () =>
        Effect.gen(function* () {
          return yield* Effect.try({
            try: () => {
              let totalSize = 0
              let itemCount = 0

              for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i)

                pipe(
                  Option.fromNullable(key),
                  Option.filter(
                    (k) => k.startsWith(STORAGE_PREFIX) || k.startsWith(BACKUP_PREFIX) || k.startsWith(STATE_PREFIX)
                  ),
                  Option.match({
                    onNone: () => {},
                    onSome: (k) => {
                      const value = localStorage.getItem(k)
                      pipe(
                        Option.fromNullable(value),
                        Option.match({
                          onNone: () => {},
                          onSome: (v) => {
                            totalSize += new Blob([v]).size
                            itemCount++
                          },
                        })
                      )
                    },
                  })
                )
              }

              // Rough estimate of available space (localStorage typically 5-10MB)
              const availableSpace = Math.max(0, 5 * 1024 * 1024 - totalSize)

              return {
                totalSize,
                availableSpace,
                itemCount,
              }
            },
            catch: (error) => new StorageError('LOAD_FAILED', error),
          })
        }),
    })
  })
)

// Default configuration
export const defaultStorageConfig: StorageConfig = {
  storageType: 'localStorage',
  autoSave: true,
  saveInterval: 5000, // 5 seconds
  backupCount: 3,
  compressionEnabled: false,
}
