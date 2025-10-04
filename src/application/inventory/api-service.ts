import { Schema } from '@effect/schema'
import { Context, Data, Effect, Layer, Match, Option, pipe } from 'effect'
import type { Inventory, PlayerId } from '@mc/bc-inventory/domain/inventory-types'
import { InventoryService } from '@mc/bc-inventory/domain/inventory-service'
import type { InventoryServiceError } from '@mc/bc-inventory/domain/inventory-service'

// ================================================================
// アプリケーション固有のADT
// ================================================================

type InventoryCommand =
  | { readonly _tag: 'SortInventory'; readonly playerId: PlayerId }
  | { readonly _tag: 'SnapshotInventory'; readonly playerId: PlayerId }

const InventoryApiError = Data.taggedEnum('InventoryApiError')({
  DomainFailure: Data.struct<{ readonly cause: InventoryServiceError }>(),
})

export type InventoryApiError = ReturnType<(typeof InventoryApiError)['DomainFailure']>

const fromDomainError = (cause: InventoryServiceError): InventoryApiError =>
  InventoryApiError.DomainFailure({ cause })

// ================================================================
// 応答DTO
// ================================================================

const InventoryStatsSchema = Schema.Struct({
  totalSlots: Schema.Number,
  usedSlots: Schema.Number,
  emptySlots: Schema.Number,
  uniqueItems: Schema.Number,
})
export type InventoryStats = Schema.Schema.Type<typeof InventoryStatsSchema>

const InventorySnapshotSchema = Schema.Struct({
  playerId: Schema.String,
  stats: InventoryStatsSchema,
  slotCount: Schema.Number,
  hotbarSelection: Schema.Number,
  uniqueItemIds: Schema.Array(Schema.String),
  version: Schema.Number,
  lastUpdated: Schema.Number,
  checksum: Schema.String,
})

export type InventorySnapshot = Schema.Schema.Type<typeof InventorySnapshotSchema>

const encodeSnapshot = Schema.encodeSync(InventorySnapshotSchema)

// ================================================================
// サービス定義
// ================================================================

export interface InventoryAPIService {
  readonly execute: (
    command: InventoryCommand
  ) => Effect.Effect<InventorySnapshot, InventoryApiError>
}

export const InventoryAPIService = Context.GenericTag<InventoryAPIService>(
  '@minecraft/application/inventory/APIService'
)

// ================================================================
// 実装ヘルパ
// ================================================================

const materializeInventory = (
  inventory: Inventory
): Effect.Effect<InventorySnapshot> =>
  Effect.sync(() => {
    const summary = inventory.slots.reduce(
      (acc, slot) =>
        Option.fromNullable(slot).pipe(
          Option.match({
            onNone: () => acc,
            onSome: (value) => ({
              total: acc.total + 1,
              items: acc.items.add(value.itemId),
            }),
          })
        ),
      { total: 0, items: new Set<string>() }
    )

    return encodeSnapshot({
      playerId: inventory.playerId,
      stats: {
        totalSlots: inventory.slots.length,
        usedSlots: summary.total,
        emptySlots: inventory.slots.length - summary.total,
        uniqueItems: summary.items.size,
      },
      slotCount: inventory.slots.length,
      hotbarSelection: inventory.selectedSlot,
      uniqueItemIds: Array.from(summary.items.values()),
      version: inventory.version,
      lastUpdated: inventory.metadata.lastUpdated,
      checksum: inventory.metadata.checksum,
    })
  })

const processCommand = (
  command: InventoryCommand,
  inventoryService: InventoryService
): Effect.Effect<InventorySnapshot, InventoryApiError> =>
  Match.value(command._tag).pipe(
    Match.when('SortInventory', () =>
      Effect.gen(function* () {
        yield* inventoryService.sortInventory(command.playerId).pipe(
          Effect.mapError(fromDomainError)
        )
        const sorted = yield* inventoryService.getInventory(command.playerId)
        return yield* materializeInventory(sorted)
      })
    ),
    Match.when('SnapshotInventory', () =>
      Effect.gen(function* () {
        const inventory = yield* inventoryService.getInventory(command.playerId)
        return yield* materializeInventory(inventory)
      })
    ),
    Match.exhaustive
  )

// ================================================================
// Layer
// ================================================================

export const InventoryAPIServiceLive = Layer.effect(
  InventoryAPIService,
  Effect.gen(function* () {
    const inventoryService = yield* InventoryService

    const service: InventoryAPIService = {
      execute: (command) => processCommand(command, inventoryService),
    }

    return service
  })
)

// ================================================================
// テスト用補助
// ================================================================

export const sortInventoryCommand = (playerId: PlayerId): InventoryCommand => ({
  _tag: 'SortInventory',
  playerId,
})

export const snapshotInventoryCommand = (playerId: PlayerId): InventoryCommand => ({
  _tag: 'SnapshotInventory',
  playerId,
})
