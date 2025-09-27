/**
 * InventoryAPIService - 統合型インベントリ操作API
 *
 * ユーザー向けの高レベルAPI。Effect-TS、Zustand、永続化を統合し、
 * 使いやすいインベントリ操作インターフェースを提供
 */

import { Context, Effect, Layer, Match, Option, pipe, Array as EffectArray } from 'effect'
import { Inventory, ItemStack, PlayerId } from './InventoryTypes.js'
import { InventoryService } from './InventoryService.js'
import { InventoryStorageService } from './InventoryStorageService.js'
import { ItemManagerService, ItemManagerServiceLive, EnhancedItemStack } from './ItemManagerService.js'
import { InventoryIntegrationService, InventoryIntegrationServiceLive } from './InventoryIntegrationLayer.js'
import { InventoryServiceLive } from './InventoryServiceLive.js'
import { LocalStorageInventoryService } from './InventoryStorageService.js'

// API Response types
export interface APIResponse<T> {
  readonly success: boolean
  readonly data?: T
  readonly error?: string
  readonly timestamp: number
}

export interface InventorySnapshot {
  readonly playerId: PlayerId
  readonly inventory: Inventory
  readonly stats: {
    readonly totalSlots: number
    readonly usedSlots: number
    readonly emptySlots: number
    readonly uniqueItems: number
  }
  readonly metadata: {
    readonly lastModified: number
    readonly version: string
    readonly checksum: string
  }
}

export interface ItemOperationResult {
  readonly success: boolean
  readonly affectedSlots: readonly number[]
  readonly remainingItems: number // exactOptionalPropertyTypesに対応するため必須に変更
  readonly message?: string
}

export interface BulkOperationResult {
  readonly totalOperations: number
  readonly successfulOperations: number
  readonly failedOperations: number
  readonly results: readonly ItemOperationResult[]
  readonly errors: readonly string[]
}

// API Service Interface
export interface InventoryAPIService {
  // Player Management
  readonly createPlayerInventory: (playerId: PlayerId) => Effect.Effect<APIResponse<Inventory>, never>
  readonly getPlayerInventory: (playerId: PlayerId) => Effect.Effect<APIResponse<InventorySnapshot>, never>
  readonly deletePlayerInventory: (playerId: PlayerId) => Effect.Effect<APIResponse<void>, never>
  readonly listPlayers: () => Effect.Effect<APIResponse<readonly PlayerId[]>, never>

  // Item Operations
  readonly addItem: (
    playerId: PlayerId,
    itemId: string,
    count?: number
  ) => Effect.Effect<APIResponse<ItemOperationResult>, never>
  readonly removeItem: (
    playerId: PlayerId,
    slotIndex: number,
    count?: number
  ) => Effect.Effect<APIResponse<ItemOperationResult>, never>
  readonly moveItem: (
    playerId: PlayerId,
    fromSlot: number,
    toSlot: number,
    count?: number
  ) => Effect.Effect<APIResponse<ItemOperationResult>, never>
  readonly swapItems: (
    playerId: PlayerId,
    slot1: number,
    slot2: number
  ) => Effect.Effect<APIResponse<ItemOperationResult>, never>
  readonly splitStack: (
    playerId: PlayerId,
    sourceSlot: number,
    targetSlot: number,
    count: number
  ) => Effect.Effect<APIResponse<ItemOperationResult>, never>

  // Bulk Operations
  readonly addMultipleItems: (
    playerId: PlayerId,
    items: readonly { itemId: string; count: number }[]
  ) => Effect.Effect<APIResponse<BulkOperationResult>, never>
  readonly clearInventory: (playerId: PlayerId) => Effect.Effect<APIResponse<ItemOperationResult>, never>
  readonly sortInventory: (playerId: PlayerId) => Effect.Effect<APIResponse<ItemOperationResult>, never>
  readonly compactInventory: (playerId: PlayerId) => Effect.Effect<APIResponse<ItemOperationResult>, never>

  // Search and Query
  readonly findItems: (playerId: PlayerId, itemId: string) => Effect.Effect<APIResponse<readonly number[]>, never>
  readonly countItems: (playerId: PlayerId, itemId: string) => Effect.Effect<APIResponse<number>, never>
  readonly searchItems: (
    playerId: PlayerId,
    query: string
  ) => Effect.Effect<APIResponse<readonly { slotIndex: number; item: ItemStack }[]>, never>
  readonly getItemsByCategory: (
    playerId: PlayerId,
    category: string
  ) => Effect.Effect<APIResponse<readonly { slotIndex: number; item: ItemStack }[]>, never>

  // Inventory State
  readonly getInventoryStats: (playerId: PlayerId) => Effect.Effect<APIResponse<InventorySnapshot['stats']>, never>
  readonly validateInventory: (
    playerId: PlayerId
  ) => Effect.Effect<APIResponse<{ valid: boolean; issues: readonly string[] }>, never>
  readonly getInventoryChecksum: (playerId: PlayerId) => Effect.Effect<APIResponse<string>, never>

  // Hotbar Operations
  readonly setSelectedSlot: (
    playerId: PlayerId,
    slotIndex: number
  ) => Effect.Effect<APIResponse<ItemOperationResult>, never>
  readonly getSelectedItem: (playerId: PlayerId) => Effect.Effect<APIResponse<ItemStack | null>, never>
  readonly setHotbarSlot: (
    playerId: PlayerId,
    hotbarIndex: number,
    inventorySlot: number
  ) => Effect.Effect<APIResponse<ItemOperationResult>, never>

  // Storage Operations
  readonly saveInventory: (playerId: PlayerId) => Effect.Effect<APIResponse<void>, never>
  readonly loadInventory: (playerId: PlayerId) => Effect.Effect<APIResponse<InventorySnapshot>, never>
  readonly exportInventory: (playerId: PlayerId) => Effect.Effect<APIResponse<string>, never> // JSON export
  readonly importInventory: (playerId: PlayerId, data: string) => Effect.Effect<APIResponse<ItemOperationResult>, never> // JSON import

  // Backup Operations
  readonly createBackup: (playerId: PlayerId) => Effect.Effect<APIResponse<string>, never> // Returns backup ID
  readonly restoreBackup: (
    playerId: PlayerId,
    backupId: string
  ) => Effect.Effect<APIResponse<ItemOperationResult>, never>
  readonly listBackups: (playerId: PlayerId) => Effect.Effect<APIResponse<readonly string[]>, never>
  readonly deleteBackup: (playerId: PlayerId, backupId: string) => Effect.Effect<APIResponse<void>, never>

  // Advanced Operations
  readonly transferBetweenPlayers: (
    fromPlayerId: PlayerId,
    toPlayerId: PlayerId,
    slotIndex: number,
    count?: number
  ) => Effect.Effect<APIResponse<ItemOperationResult>, never>
  readonly duplicateInventory: (
    sourcePlayerId: PlayerId,
    targetPlayerId: PlayerId
  ) => Effect.Effect<APIResponse<ItemOperationResult>, never>
  readonly mergeInventories: (
    playerId1: PlayerId,
    playerId2: PlayerId,
    targetPlayerId: PlayerId
  ) => Effect.Effect<APIResponse<BulkOperationResult>, never>
}

// Context tag
export const InventoryAPIService = Context.GenericTag<InventoryAPIService>('@minecraft/domain/InventoryAPIService')

// Helper functions
const createSuccessResponse = <T>(data: T): APIResponse<T> => ({
  success: true,
  data,
  timestamp: Date.now(),
})

const createErrorResponse = (error: string): APIResponse<never> => ({
  success: false,
  error,
  timestamp: Date.now(),
})

const createChecksum = (inventory: Inventory): string => {
  const data = JSON.stringify(inventory)
  // Simple hash function - in production, use a proper hash library
  let hash = 0
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & hash // Convert to 32-bit integer
  }
  return hash.toString(36)
}

const createInventoryStats = (inventory: Inventory) => ({
  totalSlots: 36,
  usedSlots: inventory.slots.filter((slot) => slot !== null).length,
  emptySlots: inventory.slots.filter((slot) => slot === null).length,
  uniqueItems: new Set(inventory.slots.filter((slot) => slot !== null).map((slot) => slot!.itemId)).size,
})

// API Service Implementation
export const InventoryAPIServiceLive = Layer.effect(
  InventoryAPIService,
  Effect.gen(function* () {
    // すべての依存関係を先に取得
    const inventoryService = yield* InventoryService
    const inventoryStorageService = yield* InventoryStorageService
    const itemManager = yield* ItemManagerService
    const integrationService = yield* InventoryIntegrationService

    return InventoryAPIService.of({
      createPlayerInventory: (playerId: PlayerId) =>
        pipe(
          inventoryService.createInventory(playerId),
          Effect.map(createSuccessResponse),
          Effect.catchAll((error) =>
            Effect.succeed(createErrorResponse(`Failed to create inventory: ${String(error)}`))
          )
        ),

      getPlayerInventory: (playerId: PlayerId) =>
        pipe(
          inventoryService.getInventory(playerId),
          Effect.map((inventory) => {
            const stats = createInventoryStats(inventory)
            const checksum = createChecksum(inventory)

            const snapshot: InventorySnapshot = {
              playerId,
              inventory,
              stats,
              metadata: {
                lastModified: Date.now(),
                version: '1.0.0',
                checksum,
              },
            }

            return createSuccessResponse(snapshot)
          }),
          Effect.catchAll((error) => Effect.succeed(createErrorResponse(`Failed to get inventory: ${String(error)}`)))
        ),

      deletePlayerInventory: (playerId: PlayerId) =>
        pipe(
          inventoryStorageService.deleteInventory(playerId),
          Effect.map(() => createSuccessResponse(undefined as void)),
          Effect.catchAll((error) =>
            Effect.succeed(createErrorResponse(`Failed to delete inventory: ${String(error)}`))
          )
        ),

      listPlayers: () =>
        pipe(
          inventoryStorageService.listStoredInventories(),
          Effect.map(createSuccessResponse),
          Effect.catchAll((error) => Effect.succeed(createErrorResponse(`Failed to list players: ${String(error)}`)))
        ),

      addItem: (playerId: PlayerId, itemId: string, count = 1) =>
        pipe(
          Effect.gen(function* () {
            const item = yield* itemManager.createItem(itemId as any, count)
            const result = yield* inventoryService.addItem(playerId, item)

            const operationResult: ItemOperationResult = {
              success: result._tag === 'success' || result._tag === 'partial',
              affectedSlots:
                result._tag === 'success'
                  ? result.affectedSlots
                  : result._tag === 'partial'
                    ? result.affectedSlots
                    : [],
              remainingItems: result._tag === 'partial' ? result.remainingItems : 0, // undefined -> 0 for exactOptionalPropertyTypes
              message:
                result._tag === 'success'
                  ? `Successfully added ${count} ${itemId}`
                  : result._tag === 'partial'
                    ? `Partially added items`
                    : result.message,
            }

            return createSuccessResponse(operationResult)
          }),
          Effect.catchAll((error) => Effect.succeed(createErrorResponse(`Failed to add item: ${String(error)}`)))
        ),

      removeItem: (playerId: PlayerId, slotIndex: number, count = 1) =>
        pipe(
          inventoryService.removeItem(playerId, slotIndex, count),
          Effect.map((removedItem) => {
            const result: ItemOperationResult = {
              success: removedItem !== null,
              affectedSlots: removedItem ? [slotIndex] : [],
              remainingItems: 0, // 必須プロパティとして定義
              message: removedItem ? `Removed ${removedItem.count} items from slot ${slotIndex}` : 'No items to remove',
            }
            return createSuccessResponse(result)
          }),
          Effect.catchAll((error) => Effect.succeed(createErrorResponse(`Failed to remove item: ${String(error)}`)))
        ),

      moveItem: (playerId: PlayerId, fromSlot: number, toSlot: number, count?: number) =>
        pipe(
          inventoryService.moveItem(playerId, fromSlot, toSlot, count),
          Effect.map(() => {
            const result: ItemOperationResult = {
              success: true,
              affectedSlots: [fromSlot, toSlot],
              remainingItems: 0,
              message: `Moved item from slot ${fromSlot} to slot ${toSlot}`,
            }
            return createSuccessResponse(result)
          }),
          Effect.catchAll((error) => Effect.succeed(createErrorResponse(`Failed to move item: ${String(error)}`)))
        ),

      swapItems: (playerId: PlayerId, slot1: number, slot2: number) =>
        pipe(
          inventoryService.swapItems(playerId, slot1, slot2),
          Effect.map(() => {
            const result: ItemOperationResult = {
              success: true,
              affectedSlots: [slot1, slot2],
              remainingItems: 0,
              message: `Swapped items between slots ${slot1} and ${slot2}`,
            }
            return createSuccessResponse(result)
          }),
          Effect.catchAll((error) => Effect.succeed(createErrorResponse(`Failed to swap items: ${String(error)}`)))
        ),

      splitStack: (playerId: PlayerId, sourceSlot: number, targetSlot: number, count: number) =>
        pipe(
          inventoryService.splitStack(playerId, sourceSlot, targetSlot, count),
          Effect.map(() => {
            const result: ItemOperationResult = {
              success: true,
              affectedSlots: [sourceSlot, targetSlot],
              remainingItems: 0,
              message: `Split ${count} items from slot ${sourceSlot} to slot ${targetSlot}`,
            }
            return createSuccessResponse(result)
          }),
          Effect.catchAll((error) => Effect.succeed(createErrorResponse(`Failed to split stack: ${String(error)}`)))
        ),

      addMultipleItems: (playerId: PlayerId, items: readonly { itemId: string; count: number }[]) =>
        pipe(
          Effect.gen(function* () {
            const results = yield* Effect.forEach(
              items,
              ({ itemId, count }) =>
                pipe(
                  itemManager.createItem(itemId as any, count),
                  Effect.flatMap((item) => inventoryService.addItem(playerId, item)),
                  Effect.map((result) => ({ _tag: result._tag, result })),
                  Effect.catchAll((error) => Effect.succeed({ _tag: 'error' as const, error: String(error) }))
                ),
              { concurrency: 1 }
            )

            const successful = results.filter((r) => r._tag !== 'error').length
            const failed = results.length - successful
            const errors = results
              .filter((r): r is { _tag: 'error'; error: string } => r._tag === 'error')
              .map((r) => r.error)

            const bulkResult: BulkOperationResult = {
              totalOperations: items.length,
              successfulOperations: successful,
              failedOperations: failed,
              results: results.map(
                (r, index) =>
                  ({
                    success: r._tag !== 'error',
                    affectedSlots: [],
                    remainingItems: 0,
                    message:
                      r._tag === 'error'
                        ? r.error
                        : `Added ${items[index]?.count ?? 0} ${items[index]?.itemId ?? 'unknown'}`,
                  }) as ItemOperationResult
              ),
              errors,
            }

            return createSuccessResponse(bulkResult)
          }),
          Effect.catchAll((error) =>
            Effect.succeed(createErrorResponse(`Failed to add multiple items: ${String(error)}`))
          )
        ),

      clearInventory: (playerId: PlayerId) =>
        pipe(
          inventoryService.clearInventory(playerId),
          Effect.map(() => {
            const result: ItemOperationResult = {
              success: true,
              affectedSlots: Array.from({ length: 36 }, (_, i) => i),
              remainingItems: 0,
              message: 'Inventory cleared successfully',
            }
            return createSuccessResponse(result)
          }),
          Effect.catchAll((error) => Effect.succeed(createErrorResponse(`Failed to clear inventory: ${String(error)}`)))
        ),

      sortInventory: (playerId: PlayerId) =>
        pipe(
          inventoryService.sortInventory(playerId),
          Effect.map(() => {
            const result: ItemOperationResult = {
              success: true,
              affectedSlots: Array.from({ length: 36 }, (_, i) => i),
              remainingItems: 0,
              message: 'Inventory sorted successfully',
            }
            return createSuccessResponse(result)
          }),
          Effect.catchAll((error) => Effect.succeed(createErrorResponse(`Failed to sort inventory: ${String(error)}`)))
        ),

      compactInventory: (playerId: PlayerId) =>
        pipe(
          inventoryService.compactInventory(playerId),
          Effect.map(() => {
            const result: ItemOperationResult = {
              success: true,
              affectedSlots: Array.from({ length: 36 }, (_, i) => i),
              remainingItems: 0,
              message: 'Inventory compacted successfully',
            }
            return createSuccessResponse(result)
          }),
          Effect.catchAll((error) =>
            Effect.succeed(createErrorResponse(`Failed to compact inventory: ${String(error)}`))
          )
        ),

      findItems: (playerId: PlayerId, itemId: string) =>
        pipe(
          inventoryService.findItemSlots(playerId, itemId),
          Effect.map(createSuccessResponse),
          Effect.catchAll((error) => Effect.succeed(createErrorResponse(`Failed to find items: ${String(error)}`)))
        ),

      countItems: (playerId: PlayerId, itemId: string) =>
        pipe(
          inventoryService.countItem(playerId, itemId),
          Effect.map(createSuccessResponse),
          Effect.catchAll((error) => Effect.succeed(createErrorResponse(`Failed to count items: ${String(error)}`)))
        ),

      searchItems: (playerId: PlayerId, query: string) =>
        pipe(
          inventoryService.getInventory(playerId),
          Effect.map((inventory) => {
            const matchingItems = inventory.slots
              .map((item, index) => ({ item, index }))
              .filter(({ item }) => item && item.itemId.toLowerCase().includes(query.toLowerCase()))
              .map(({ item, index }) => ({ slotIndex: index, item: item! }))

            return createSuccessResponse(matchingItems)
          }),
          Effect.catchAll((error) => Effect.succeed(createErrorResponse(`Failed to search items: ${String(error)}`)))
        ),

      getItemsByCategory: (playerId: PlayerId, category: string) =>
        pipe(
          Effect.gen(function* () {
            const inventory = yield* inventoryService.getInventory(playerId)
            const itemsByCategory = yield* itemManager.getItemsByCategory(category as any)
            const categoryItemIds = new Set(itemsByCategory.map((item) => item.id))

            const matchingItems = inventory.slots
              .map((item, index) => ({ item, index }))
              .filter(({ item }) => item && categoryItemIds.has(item.itemId as any))
              .map(({ item, index }) => ({ slotIndex: index, item: item! }))

            return createSuccessResponse(matchingItems)
          }),
          Effect.catchAll((error) =>
            Effect.succeed(createErrorResponse(`Failed to get items by category: ${String(error)}`))
          )
        ),

      getInventoryStats: (playerId: PlayerId) =>
        pipe(
          inventoryService.getInventory(playerId),
          Effect.map((inventory) => createSuccessResponse(createInventoryStats(inventory))),
          Effect.catchAll((error) =>
            Effect.succeed(createErrorResponse(`Failed to get inventory stats: ${String(error)}`))
          )
        ),

      validateInventory: (playerId: PlayerId) =>
        pipe(
          inventoryService.getInventory(playerId),
          Effect.map((inventory) => {
            const issues: string[] = []

            // Validate slot count
            if (inventory.slots.length !== 36) {
              issues.push(`Invalid slot count: expected 36, got ${inventory.slots.length}`)
            }

            // Validate hotbar references
            inventory.hotbar.forEach((slotIndex, hotbarIndex) => {
              if (slotIndex < 0 || slotIndex >= 36) {
                issues.push(`Invalid hotbar[${hotbarIndex}] reference: ${slotIndex}`)
              }
            })

            // Validate selected slot
            if (inventory.selectedSlot < 0 || inventory.selectedSlot > 8) {
              issues.push(`Invalid selected slot: ${inventory.selectedSlot}`)
            }

            const result = {
              valid: issues.length === 0,
              issues,
            }

            return createSuccessResponse(result)
          }),
          Effect.catchAll((error) =>
            Effect.succeed(createErrorResponse(`Failed to validate inventory: ${String(error)}`))
          )
        ),

      getInventoryChecksum: (playerId: PlayerId) =>
        pipe(
          inventoryService.getInventory(playerId),
          Effect.map((inventory) => createSuccessResponse(createChecksum(inventory))),
          Effect.catchAll((error) => Effect.succeed(createErrorResponse(`Failed to get checksum: ${String(error)}`)))
        ),

      setSelectedSlot: (playerId: PlayerId, slotIndex: number) =>
        pipe(
          inventoryService.setSelectedSlot(playerId, slotIndex),
          Effect.map(() => {
            const result: ItemOperationResult = {
              success: true,
              affectedSlots: [],
              remainingItems: 0,
              message: `Selected slot ${slotIndex}`,
            }
            return createSuccessResponse(result)
          }),
          Effect.catchAll((error) =>
            Effect.succeed(createErrorResponse(`Failed to set selected slot: ${String(error)}`))
          )
        ),

      getSelectedItem: (playerId: PlayerId) =>
        pipe(
          inventoryService.getSelectedItem(playerId),
          Effect.map(createSuccessResponse),
          Effect.catchAll((error) =>
            Effect.succeed(createErrorResponse(`Failed to get selected item: ${String(error)}`))
          )
        ),

      setHotbarSlot: (playerId: PlayerId, hotbarIndex: number, inventorySlot: number) =>
        pipe(
          inventoryService.transferToHotbar(playerId, inventorySlot, hotbarIndex),
          Effect.map(() => {
            const result: ItemOperationResult = {
              success: true,
              affectedSlots: [inventorySlot],
              remainingItems: 0,
              message: `Set hotbar slot ${hotbarIndex} to inventory slot ${inventorySlot}`,
            }
            return createSuccessResponse(result)
          }),
          Effect.catchAll((error) => Effect.succeed(createErrorResponse(`Failed to set hotbar slot: ${String(error)}`)))
        ),

      saveInventory: (playerId: PlayerId) =>
        pipe(
          integrationService.savePlayerInventory(playerId),
          Effect.map(() => createSuccessResponse(undefined)),
          Effect.catchAll((error) => Effect.succeed(createErrorResponse(`Failed to save inventory: ${String(error)}`))),
          Effect.provide(
            Layer.mergeAll(
              InventoryIntegrationServiceLive,
              InventoryServiceLive,
              LocalStorageInventoryService,
              ItemManagerServiceLive
            )
          )
        ) as Effect.Effect<APIResponse<void>, never, never>,

      loadInventory: (playerId: PlayerId) =>
        pipe(
          integrationService.loadPlayerInventory(playerId),
          Effect.flatMap(() => inventoryService.getInventory(playerId)),
          Effect.map(createSuccessResponse),
          Effect.catchAll((error) => Effect.succeed(createErrorResponse(`Failed to load inventory: ${String(error)}`))),
          Effect.provide(
            Layer.mergeAll(
              InventoryIntegrationServiceLive,
              InventoryServiceLive,
              LocalStorageInventoryService,
              ItemManagerServiceLive
            )
          )
        ) as unknown as Effect.Effect<APIResponse<InventorySnapshot>, never, never>,

      exportInventory: (playerId: PlayerId) =>
        pipe(
          inventoryService.getInventoryState(playerId),
          Effect.map((state) => createSuccessResponse(JSON.stringify(state, null, 2))),
          Effect.catchAll((error) =>
            Effect.succeed(createErrorResponse(`Failed to export inventory: ${String(error)}`))
          )
        ),

      importInventory: (playerId: PlayerId, data: string) =>
        pipe(
          Effect.try(() => JSON.parse(data)),
          Effect.flatMap((parsed) => inventoryService.loadInventoryState(parsed)),
          Effect.map(() => {
            const result: ItemOperationResult = {
              success: true,
              affectedSlots: Array.from({ length: 36 }, (_, i) => i),
              remainingItems: 0,
              message: 'Inventory imported successfully',
            }
            return createSuccessResponse(result)
          }),
          Effect.catchAll((error) =>
            Effect.succeed(createErrorResponse(`Failed to import inventory: ${String(error)}`))
          )
        ),

      createBackup: (playerId: PlayerId) =>
        pipe(
          inventoryStorageService.createBackup(playerId),
          Effect.map(createSuccessResponse),
          Effect.catchAll((error) => Effect.succeed(createErrorResponse(`Failed to create backup: ${String(error)}`)))
        ),

      restoreBackup: (playerId: PlayerId, backupId: string) =>
        pipe(
          inventoryStorageService.restoreBackup(playerId, backupId),
          Effect.flatMap(() => integrationService.syncToZustand(playerId)),
          Effect.map(() => {
            const result: ItemOperationResult = {
              success: true,
              affectedSlots: Array.from({ length: 36 }, (_, i) => i),
              remainingItems: 0,
              message: `Restored backup ${backupId}`,
            }
            return createSuccessResponse(result)
          }),
          Effect.catchAll((error) => Effect.succeed(createErrorResponse(`Failed to restore backup: ${String(error)}`))),
          Effect.provide(
            Layer.mergeAll(
              InventoryIntegrationServiceLive,
              InventoryServiceLive,
              LocalStorageInventoryService,
              ItemManagerServiceLive
            )
          )
        ) as Effect.Effect<APIResponse<ItemOperationResult>, never, never>,

      listBackups: (playerId: PlayerId) =>
        pipe(
          // This would need to be implemented in the storage service
          Effect.succeed([]),
          Effect.map(createSuccessResponse),
          Effect.catchAll((error) => Effect.succeed(createErrorResponse(`Failed to list backups: ${String(error)}`)))
        ),

      deleteBackup: (playerId: PlayerId, backupId: string) =>
        pipe(
          // This would need to be implemented in the storage service
          Effect.succeed(undefined),
          Effect.map(() => createSuccessResponse(undefined)),
          Effect.catchAll((error) => Effect.succeed(createErrorResponse(`Failed to delete backup: ${String(error)}`)))
        ),

      transferBetweenPlayers: (fromPlayerId: PlayerId, toPlayerId: PlayerId, slotIndex: number, count = 1) =>
        pipe(
          Effect.gen(function* () {
            const item = yield* inventoryService.getSlotItem(fromPlayerId, slotIndex)

            return yield* pipe(
              Option.fromNullable(item),
              Option.match({
                onNone: () =>
                  Effect.succeed({
                    success: false,
                    affectedSlots: [],
                    remainingItems: 0,
                    message: 'No item to transfer',
                  }),
                onSome: (item) =>
                  Effect.gen(function* () {
                    const transferCount = Math.min(count, item.count)
                    const transferItem: ItemStack = { ...item, count: transferCount }

                    yield* inventoryService.removeItem(fromPlayerId, slotIndex, transferCount)
                    const addResult = yield* inventoryService.addItem(toPlayerId, transferItem)

                    return {
                      success: addResult._tag === 'success',
                      affectedSlots: [slotIndex],
                      remainingItems: 0,
                      message: `Transferred ${transferCount} items from ${fromPlayerId} to ${toPlayerId}`,
                    }
                  }),
              })
            )
          }),
          Effect.map(createSuccessResponse),
          Effect.catchAll((error) =>
            Effect.succeed(createErrorResponse(`Failed to transfer between players: ${String(error)}`))
          )
        ),

      duplicateInventory: (sourcePlayerId: PlayerId, targetPlayerId: PlayerId) =>
        pipe(
          Effect.gen(function* () {
            const sourceInventory = yield* inventoryService.getInventory(sourcePlayerId)
            yield* inventoryService.clearInventory(targetPlayerId)

            const results = yield* Effect.forEach(
              sourceInventory.slots,
              (item, index) =>
                pipe(
                  Option.fromNullable(item),
                  Option.match({
                    onNone: () => Effect.succeed(true),
                    onSome: (item) =>
                      pipe(
                        inventoryService.setSlotItem(targetPlayerId, index, item),
                        Effect.map(() => true),
                        Effect.catchAll(() => Effect.succeed(false))
                      ),
                  })
                ),
              { concurrency: 1 }
            )

            const successful = results.filter((r) => r).length
            const failed = results.length - successful

            const result: ItemOperationResult = {
              success: failed === 0,
              affectedSlots: Array.from({ length: 36 }, (_, i) => i),
              remainingItems: 0,
              message: `Duplicated inventory: ${successful} successful, ${failed} failed`,
            }

            return createSuccessResponse(result)
          }),
          Effect.catchAll((error) =>
            Effect.succeed(createErrorResponse(`Failed to duplicate inventory: ${String(error)}`))
          )
        ),

      mergeInventories: (playerId1: PlayerId, playerId2: PlayerId, targetPlayerId: PlayerId) =>
        pipe(
          Effect.gen(function* () {
            const inventory1 = yield* inventoryService.getInventory(playerId1)
            const inventory2 = yield* inventoryService.getInventory(playerId2)
            yield* inventoryService.clearInventory(targetPlayerId)

            const allItems = [
              ...inventory1.slots.filter((item) => item !== null),
              ...inventory2.slots.filter((item) => item !== null),
            ].filter((item): item is ItemStack => item !== null)

            const results = yield* Effect.forEach(
              allItems,
              (item) =>
                pipe(
                  inventoryService.addItem(targetPlayerId, item),
                  Effect.map((result) => ({ success: result._tag === 'success', result })),
                  Effect.catchAll((error) => Effect.succeed({ success: false, error: String(error) }))
                ),
              { concurrency: 1 }
            )

            const successful = results.filter((r) => r.success).length
            const failed = results.length - successful
            const errors = results
              .filter((r): r is { success: false; error: string } => !r.success && 'error' in r)
              .map((r) => r.error)

            const bulkResult: BulkOperationResult = {
              totalOperations: allItems.length,
              successfulOperations: successful,
              failedOperations: failed,
              results: results.map((r) => ({
                success: r.success,
                affectedSlots: r.success && 'result' in r && r.result._tag === 'success' ? r.result.affectedSlots : [],
                remainingItems: 0,
                message: r.success ? 'Item added successfully' : 'error' in r ? r.error : 'Unknown error',
              })),
              errors,
            }

            return createSuccessResponse(bulkResult)
          }),
          Effect.catchAll((error) =>
            Effect.succeed(createErrorResponse(`Failed to merge inventories: ${String(error)}`))
          )
        ),
    })
  })
).pipe(
  Layer.provide(InventoryIntegrationServiceLive),
  Layer.provide(InventoryServiceLive),
  Layer.provide(LocalStorageInventoryService),
  Layer.provide(ItemManagerServiceLive)
)
