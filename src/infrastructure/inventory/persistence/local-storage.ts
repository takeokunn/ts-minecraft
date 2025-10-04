/**
 * LocalStorage-based inventory persistence service
 *
 * LocalStorageを使用したInventoryデータの永続化を提供
 * Zustand persistとの統合も含む
 */

import { Effect, Layer, Match, Option, pipe } from 'effect'

// Import domain types (interfaces only)
import type { Inventory, InventoryState, PlayerId } from '../../../domain/inventory/types'
import { validateInventoryState } from '../../../domain/inventory/types'
import { InventoryStorageService as InventoryStorageServiceTag, StorageError } from '../storage-service'

// LocalStorage implementation
export const LocalStorageInventoryService = Layer.effect(
  InventoryStorageServiceTag,
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

    return InventoryStorageServiceTag.of({
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
