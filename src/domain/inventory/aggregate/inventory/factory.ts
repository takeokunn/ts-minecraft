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

  /**
   * Inventory集約のビルダーを作成
   */
  readonly builder: () => InventoryBuilder
}

export const InventoryFactory = Context.GenericTag<InventoryFactory>(
  '@minecraft/domain/inventory/aggregate/InventoryFactory'
)

// ===== Builder Pattern Implementation =====

export interface InventoryBuilder {
  /**
   * プレイヤーIDを設定
   */
  readonly setPlayerId: (playerId: PlayerId) => InventoryBuilder

  /**
   * カスタムIDを設定（テスト用）
   */
  readonly setId: (id: InventoryId) => InventoryBuilder

  /**
   * 指定スロットにアイテムを設定
   */
  readonly setSlot: (index: SlotIndex, slot: InventorySlot) => InventoryBuilder

  /**
   * ホットバー設定を追加
   */
  readonly setHotbar: (hotbar: ReadonlyArray<SlotIndex>) => InventoryBuilder

  /**
   * 防具を設定
   */
  readonly setArmor: (armor: ArmorSlot) => InventoryBuilder

  /**
   * オフハンドスロットを設定
   */
  readonly setOffhand: (slot: InventorySlot) => InventoryBuilder

  /**
   * 選択中のホットバースロットを設定
   */
  readonly setSelectedSlot: (slot: HotbarSlot) => InventoryBuilder

  /**
   * バージョンを設定
   */
  readonly setVersion: (version: number) => InventoryBuilder

  /**
   * 集約をビルド
   */
  readonly build: () => Effect.Effect<InventoryAggregate, InventoryAggregateError>
}

// ===== Builder Implementation =====

class InventoryBuilderImpl implements InventoryBuilder {
  private id: InventoryId | null = null
  private playerId: PlayerId | null = null
  private slots: Array<InventorySlot> = Array(INVENTORY_CONSTANTS.MAIN_INVENTORY_SIZE).fill(null)
  private hotbar: ReadonlyArray<SlotIndex> = Array.from({ length: INVENTORY_CONSTANTS.HOTBAR_SIZE }, (_, i) =>
    makeUnsafeSlotIndex(i)
  )
  private armor: ArmorSlot = {
    helmet: null,
    chestplate: null,
    leggings: null,
    boots: null,
  }
  private offhand: InventorySlot = null
  private selectedSlot: HotbarSlot = makeUnsafeHotbarSlot(0)
  private version: number = 1
  private lastModifiedMs: number | null = null
  private uncommittedEvents: Array<InventoryDomainEvent> = []

  setPlayerId(playerId: PlayerId): InventoryBuilder {
    this.playerId = playerId
    return this
  }

  setId(id: InventoryId): InventoryBuilder {
    this.id = id
    return this
  }

  setSlot(index: SlotIndex, slot: InventorySlot): InventoryBuilder {
    if (index < 0 || index >= INVENTORY_CONSTANTS.MAIN_INVENTORY_SIZE) {
      return this // エラーはbuild時に検証
    }
    this.slots[index] = slot
    return this
  }

  setHotbar(hotbar: ReadonlyArray<SlotIndex>): InventoryBuilder {
    if (hotbar.length === INVENTORY_CONSTANTS.HOTBAR_SIZE) {
      this.hotbar = hotbar
    }
    return this
  }

  setArmor(armor: ArmorSlot): InventoryBuilder {
    this.armor = armor
    return this
  }

  setOffhand(slot: InventorySlot): InventoryBuilder {
    this.offhand = slot
    return this
  }

  setSelectedSlot(slot: HotbarSlot): InventoryBuilder {
    this.selectedSlot = slot
    return this
  }

  setVersion(version: number): InventoryBuilder {
    this.version = version
    return this
  }

  build(): Effect.Effect<InventoryAggregate, InventoryAggregateError> {
    return Effect.gen(
      function* () {
        // 必須フィールドの検証
        yield* pipe(
          Match.value(!this.playerId),
          Match.when(true, () =>
            Effect.fail(
              new InventoryAggregateError({
                reason: 'INVALID_ITEM_TYPE',
                message: 'プレイヤーIDが設定されていません',
              })
            )
          ),
          Match.orElse(() => Effect.succeed(undefined))
        )

        // IDの生成または検証
        const id = this.id ?? makeUnsafeInventoryId(`inv_${nanoid()}`)

        // lastModifiedの取得
        const now = yield* DateTime.now
        const lastModifiedMs = this.lastModifiedMs ?? DateTime.toEpochMillis(now)
        const lastModified = DateTime.formatIso(DateTime.unsafeFromDate(new Date(lastModifiedMs)))

        // スキーマ検証
        const aggregate = yield* Schema.decodeUnknown(InventoryAggregateSchema)({
          id,
          playerId: this.playerId,
          slots: this.slots,
          hotbar: this.hotbar,
          armor: this.armor,
          offhand: this.offhand,
          selectedSlot: this.selectedSlot,
          version: this.version,
          lastModified,
          uncommittedEvents: this.uncommittedEvents,
        }).pipe(
          Effect.mapError(
            (error) =>
              new InventoryAggregateError({
                reason: 'INVALID_ITEM_TYPE',
                message: `Inventory集約の検証に失敗: ${String(error)}`,
              })
          )
        )

        return aggregate
      }.bind(this)
    )
  }
}

// ===== Factory Implementation =====

export const InventoryFactoryLive = InventoryFactory.of({
  createEmpty: (playerId: PlayerId) =>
    Effect.gen(function* () {
      const builder = new InventoryBuilderImpl()

      return yield* builder.setPlayerId(playerId).build()
    }),

  restore: (data: unknown) =>
    Effect.gen(function* () {
      // スキーマ検証による安全な復元
      return yield* Schema.decodeUnknown(InventoryAggregateSchema)(data).pipe(
        Effect.mapError(
          (error) =>
            new InventoryAggregateError({
              reason: 'INVALID_ITEM_TYPE',
              message: `データからの復元に失敗: ${String(error)}`,
            })
        )
      )
    }),

  builder: () => new InventoryBuilderImpl(),
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
