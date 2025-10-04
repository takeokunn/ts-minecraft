/**
 * InventoryStorageService - データ永続化サービス
 *
 * LocalStorageとIndexedDBを使用したInventoryデータの永続化を提供
 * Zustand persistとの統合も含む
 */

import { Schema } from '@effect/schema'
import { Context, Effect, Option } from 'effect'
import { Inventory, InventoryState, type PlayerId } from '../../domain/inventory/types'

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
export const InventoryStorageService = Context.GenericTag<InventoryStorageService>(
  '@minecraft/infrastructure/inventory/StorageService'
)

// Default configuration
export const defaultStorageConfig: StorageConfig = {
  storageType: 'localStorage',
  autoSave: true,
  saveInterval: 5000, // 5 seconds
  backupCount: 3,
  compressionEnabled: false,
}
