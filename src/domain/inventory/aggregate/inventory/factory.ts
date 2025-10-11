/**
 * @fileoverview Inventory集約ファクトリ - ビルダーパターンによる安全な集約生成
 * DDD原則に基づく複雑なオブジェクト生成の隠蔽
 */

import { Context, DateTime, Effect, Layer, Match, pipe, Schema } from 'effect'
import { nanoid } from 'nanoid'
import type { PlayerId } from '../../types'
import type {
  ArmorSlot,
  HotbarSlot,
  InventoryAggregate,
  InventoryDomainEvent,
  InventoryId,
  InventorySlot,
  SlotIndex,
} from './types'
import {
  INVENTORY_CONSTANTS,
  InventoryAggregateError,
  InventoryAggregateErrorFactory,
  InventoryAggregateSchema,
  makeUnsafeHotbarSlot,
  makeUnsafeInventoryId,
  makeUnsafeSlotIndex,
} from './types'

// ===== Factory Interface =====

export interface InventoryFactory {
  /**
   * 新しい空のInventory集約を生成
   */
  readonly createEmpty: (playerId: PlayerId) => Effect.Effect<InventoryAggregate, InventoryAggregateError>

  /**
   * 既存データからInventory集約を復元
   */
  readonly restore: (data: unknown) => Effect.Effect<InventoryAggregate, InventoryAggregateError>

}

export const InventoryFactory = Context.GenericTag<InventoryFactory>(
  '@minecraft/domain/inventory/aggregate/InventoryFactory'
)

// ===== Builder State Schema =====

/**
 * Builderの内部状態を表すSchema
 */
export const InventoryBuilderStateSchema = Schema.Struct({
  id: Schema.NullOr(Schema.Unknown), // InventoryId
  playerId: Schema.NullOr(Schema.Unknown), // PlayerId
  slots: Schema.Array(Schema.Unknown), // Array<InventorySlot>
  hotbar: Schema.Array(Schema.Unknown), // ReadonlyArray<SlotIndex>
  armor: Schema.Struct({
    helmet: Schema.Unknown,
    chestplate: Schema.Unknown,
    leggings: Schema.Unknown,
    boots: Schema.Unknown,
  }),
  offhand: Schema.Unknown, // InventorySlot
  selectedSlot: Schema.Unknown, // HotbarSlot
  version: Schema.Number,
  lastModifiedMs: Schema.NullOr(Schema.Number),
  uncommittedEvents: Schema.Array(Schema.Unknown), // Array<InventoryDomainEvent>
})

export type InventoryBuilderState = Schema.Schema.Type<typeof InventoryBuilderStateSchema>

// ===== Builder Pure Functions =====

/**
 * 初期Builder状態を作成
 */
export const createInventoryBuilderState = (): InventoryBuilderState => ({
  id: null,
  playerId: null,
  slots: Array(INVENTORY_CONSTANTS.MAIN_INVENTORY_SIZE).fill(null),
  hotbar: Array.from({ length: INVENTORY_CONSTANTS.HOTBAR_SIZE }, (_, i) => makeUnsafeSlotIndex(i)),
  armor: {
    helmet: null,
    chestplate: null,
    leggings: null,
    boots: null,
  },
  offhand: null,
  selectedSlot: makeUnsafeHotbarSlot(0),
  version: 1,
  lastModifiedMs: null,
  uncommittedEvents: [],
})

/**
 * プレイヤーIDを設定
 */
export const withPlayerId =
  (playerId: PlayerId) =>
  (state: InventoryBuilderState): InventoryBuilderState => ({
    ...state,
    playerId,
  })

/**
 * カスタムIDを設定
 */
export const withInventoryId =
  (id: InventoryId) =>
  (state: InventoryBuilderState): InventoryBuilderState => ({
    ...state,
    id,
  })

/**
 * 指定スロットにアイテムを設定
 */
export const withInventorySlot =
  (index: SlotIndex, slot: InventorySlot) =>
  (state: InventoryBuilderState): InventoryBuilderState => {
    if (index < 0 || index >= INVENTORY_CONSTANTS.MAIN_INVENTORY_SIZE) {
      return state // エラーはbuild時に検証
    }
    const newSlots = [...state.slots]
    newSlots[index] = slot
    return {
      ...state,
      slots: newSlots,
    }
  }

/**
 * ホットバー設定を追加
 */
export const withHotbar =
  (hotbar: ReadonlyArray<SlotIndex>) =>
  (state: InventoryBuilderState): InventoryBuilderState => {
    if (hotbar.length === INVENTORY_CONSTANTS.HOTBAR_SIZE) {
      return {
        ...state,
        hotbar,
      }
    }
    return state
  }

/**
 * 防具を設定
 */
export const withArmor =
  (armor: ArmorSlot) =>
  (state: InventoryBuilderState): InventoryBuilderState => ({
    ...state,
    armor,
  })

/**
 * オフハンドスロットを設定
 */
export const withOffhand =
  (offhand: InventorySlot) =>
  (state: InventoryBuilderState): InventoryBuilderState => ({
    ...state,
    offhand,
  })

/**
 * 選択中のホットバースロットを設定
 */
export const withSelectedSlot =
  (selectedSlot: HotbarSlot) =>
  (state: InventoryBuilderState): InventoryBuilderState => ({
    ...state,
    selectedSlot,
  })

/**
 * バージョンを設定
 */
export const withInventoryVersion =
  (version: number) =>
  (state: InventoryBuilderState): InventoryBuilderState => ({
    ...state,
    version,
  })

/**
 * Builder状態からInventory集約を構築
 */
export const buildInventoryFromState = (
  state: InventoryBuilderState
): Effect.Effect<InventoryAggregate, InventoryAggregateError> =>
  Effect.gen(function* () {
    // 必須フィールドの検証
    yield* pipe(
      Match.value(!state.playerId),
      Match.when(true, () =>
        Effect.fail(
          InventoryAggregateErrorFactory.make({
            reason: 'INVALID_ITEM_TYPE',
            message: 'プレイヤーIDが設定されていません',
          })
        )
      ),
      Match.orElse(() => Effect.succeed(undefined))
    )

    // IDの生成または検証
    const id = state.id ?? makeUnsafeInventoryId(`inv_${nanoid()}`)

    // lastModifiedの取得
    const now = yield* DateTime.now
    const lastModifiedMs = state.lastModifiedMs ?? DateTime.toEpochMillis(now)
    const lastModified = DateTime.formatIso(DateTime.unsafeMake(lastModifiedMs))

    // スキーマ検証
    const aggregate = yield* Schema.decodeUnknown(InventoryAggregateSchema)({
      id,
      playerId: state.playerId,
      slots: state.slots,
      hotbar: state.hotbar,
      armor: state.armor,
      offhand: state.offhand,
      selectedSlot: state.selectedSlot,
      version: state.version,
      lastModified,
      uncommittedEvents: state.uncommittedEvents,
    }).pipe(
      Effect.mapError((error) =>
        InventoryAggregateErrorFactory.make({
          reason: 'INVALID_ITEM_TYPE',
          message: `Inventory集約の検証に失敗: ${String(error)}`,
        })
      )
    )

    return aggregate
  })

// ===== Factory Implementation =====

export const InventoryFactoryLive = InventoryFactory.of({
  createEmpty: (playerId: PlayerId) =>
    Effect.gen(function* () {
      // pure functionパターンでBuilder状態を構築
      const state = pipe(createInventoryBuilderState(), withPlayerId(playerId))

      return yield* buildInventoryFromState(state)
    }),

  restore: (data: unknown) =>
    Effect.gen(function* () {
      // スキーマ検証による安全な復元
      return yield* Schema.decodeUnknown(InventoryAggregateSchema)(data).pipe(
        Effect.mapError((error) =>
          InventoryAggregateErrorFactory.make({
            reason: 'INVALID_ITEM_TYPE',
            message: `データからの復元に失敗: ${String(error)}`,
          })
        )
      )
    }),
})

/**
 * InventoryFactory Layer
 */
export const InventoryFactoryLayer = Layer.succeed(InventoryFactory, InventoryFactoryLive)

// ===== Utility Functions =====

/**
 * 空のInventorySlotを作成
 */
export const createEmptySlot = (): InventorySlot => null

/**
 * 空の防具スロットを作成
 */
export const createEmptyArmorSlot = (): ArmorSlot => ({
  helmet: null,
  chestplate: null,
  leggings: null,
  boots: null,
})

/**
 * デフォルトのホットバー設定を作成
 */
export const createDefaultHotbar = (): ReadonlyArray<SlotIndex> =>
  Array.from({ length: INVENTORY_CONSTANTS.HOTBAR_SIZE }, (_, i) => makeUnsafeSlotIndex(i))

/**
 * 集約のバージョンを増加
 */
export const incrementVersion = (aggregate: InventoryAggregate): Effect.Effect<InventoryAggregate> =>
  Effect.gen(function* () {
    const nowDateTime = yield* DateTime.now
    const now = DateTime.formatIso(nowDateTime)
    return {
      ...aggregate,
      version: aggregate.version + 1,
      lastModified: now,
    }
  })

/**
 * 未コミットイベントを追加
 */
export const addUncommittedEvent = (
  aggregate: InventoryAggregate,
  event: InventoryDomainEvent
): InventoryAggregate => ({
  ...aggregate,
  uncommittedEvents: [...aggregate.uncommittedEvents, event],
})

/**
 * 未コミットイベントをクリア
 */
export const clearUncommittedEvents = (aggregate: InventoryAggregate): InventoryAggregate => ({
  ...aggregate,
  uncommittedEvents: [],
})
