import { Context, Effect, Layer, Match, Option, pipe, Schema } from 'effect'
import * as ReadonlyArray from 'effect/Array'
import * as HashSet from 'effect/HashSet'
import * as Order from 'effect/Order'
import type { Inventory, InventoryServiceError, PlayerId } from '../../domain/inventory'
import { InventoryService } from '../../domain/inventory'

// ================================================================
// アプリケーション固有のADT
// ================================================================

type InventoryCommand =
  | { readonly _tag: 'SortInventory'; readonly playerId: PlayerId }
  | { readonly _tag: 'SnapshotInventory'; readonly playerId: PlayerId }

export class InventoryApiError extends Schema.TaggedError<InventoryApiError>()('DomainFailure', {
  cause: Schema.Unknown,
}) {}

const fromDomainError = (cause: InventoryServiceError): InventoryApiError => new InventoryApiError({ cause })

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
  readonly execute: (command: InventoryCommand) => Effect.Effect<InventorySnapshot, InventoryApiError, InventoryService>
}

export const InventoryAPIService = Context.GenericTag<InventoryAPIService>(
  '@minecraft/application/inventory/APIService'
)

// ================================================================
// 実装ヘルパ
// ================================================================

const aggregateSlots = (inventory: Inventory): { readonly used: number; readonly unique: HashSet.HashSet<string> } =>
  pipe(
    inventory.slots,
    ReadonlyArray.reduce({ used: 0, unique: HashSet.empty<string>() }, (accumulator, slot) =>
      Option.fromNullable(slot).pipe(
        Option.match({
          onNone: () => accumulator,
          onSome: (value) => ({
            used: accumulator.used + 1,
            unique: HashSet.add(accumulator.unique, value.itemId),
          }),
        })
      )
    )
  )

const materializeInventory = (inventory: Inventory): Effect.Effect<InventorySnapshot, never, never> =>
  Effect.gen(function* () {
    const aggregates = aggregateSlots(inventory)

    const uniqueItemIds = pipe(
      HashSet.values(aggregates.unique),
      ReadonlyArray.fromIterable,
      ReadonlyArray.sort(Order.string)
    )

    const snapshot = encodeSnapshot({
      playerId: inventory.playerId,
      stats: {
        totalSlots: inventory.slots.length,
        usedSlots: aggregates.used,
        emptySlots: inventory.slots.length - aggregates.used,
        uniqueItems: HashSet.size(aggregates.unique),
      },
      slotCount: inventory.slots.length,
      hotbarSelection: inventory.selectedSlot,
      uniqueItemIds,
      version: inventory.version,
      lastUpdated: inventory.metadata.lastUpdated,
      checksum: inventory.metadata.checksum,
    })

    return snapshot
  })

const sortThenSnapshot = (
  inventoryService: InventoryService,
  playerId: PlayerId
): Effect.Effect<InventorySnapshot, InventoryApiError, InventoryService> =>
  inventoryService
    .sortInventory(playerId)
    .pipe(
      Effect.mapError(fromDomainError),
      Effect.zipRight(inventoryService.getInventory(playerId)),
      Effect.flatMap(materializeInventory)
    )

const snapshot = (
  inventoryService: InventoryService,
  playerId: PlayerId
): Effect.Effect<InventorySnapshot, InventoryApiError, InventoryService> =>
  inventoryService.getInventory(playerId).pipe(Effect.flatMap(materializeInventory))

const processCommand = (
  command: InventoryCommand,
  inventoryService: InventoryService
): Effect.Effect<InventorySnapshot, InventoryApiError, InventoryService> =>
  Match.value(command).pipe(
    Match.tag('SortInventory', ({ playerId }) => sortThenSnapshot(inventoryService, playerId)),
    Match.tag('SnapshotInventory', ({ playerId }) => snapshot(inventoryService, playerId)),
    Match.exhaustive
  )

// ================================================================
// Layer
// ================================================================

export const InventoryAPIServiceLive = Layer.effect(
  InventoryAPIService,
  Effect.gen(function* () {
    const inventoryService = yield* InventoryService

    return InventoryAPIService.of({
      execute: (command) => processCommand(command, inventoryService),
    })
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
