/**
 * @fileoverview ItemStackエンティティファクトリ
 * DDD原則に基づく複雑なエンティティ生成の隠蔽
 */

import type { JsonRecord } from '@shared/schema/json'
import { formatParseIssues } from '@shared/schema/tagged_error_factory'
import { Brand, Context, DateTime, Effect, Layer, Match, Option, Schema, pipe } from 'effect'
import { nanoid } from 'nanoid'
import type { ItemId } from '../../types'
import type { Durability, Enchantment, ItemCount, ItemNBTData, ItemStackEntity, ItemStackId } from './types'
import {
  ITEM_STACK_CONSTANTS,
  ItemCountSchema,
  ItemStackEntitySchema,
  ItemStackError,
  makeUnsafeItemStackId,
} from './types'

// ===== Branded Types for Persistence =====

/**
 * 永続化されたItemStackデータの型
 *
 * `unknown`を使用する理由:
 * - 外部ストレージ（IndexedDB/LocalStorage）から取得されたデータは実行時検証が必須
 * - Branded Typeにより、型安全な境界を明示的に定義
 * - restore関数内でSchema検証を通過して初めてItemStackEntityとして扱える
 */
export type PersistedItemStack = Brand.Brand<unknown, 'PersistedItemStack'>

// ===== Factory Interface =====

export interface ItemStackFactory {
  /**
   * 新しいItemStackエンティティを生成
   */
  readonly create: (
    itemId: ItemId,
    count: ItemCount,
    options?: ItemStackCreateOptions
  ) => Effect.Effect<ItemStackEntity, ItemStackError>

  /**
   * 既存データからItemStackエンティティを復元
   *
   * @param data - 永続化されたItemStackデータ（実行時検証が必要）
   */
  readonly restore: (data: PersistedItemStack) => Effect.Effect<ItemStackEntity, ItemStackError>
}

export const ItemStackFactory = Context.GenericTag<ItemStackFactory>(
  '@minecraft/domain/inventory/aggregate/ItemStackFactory'
)

// ===== Builder Options =====

export interface ItemStackCreateOptions {
  readonly id?: ItemStackId
  readonly durability?: Durability
  readonly nbtData?: ItemNBTData
  readonly metadata?: JsonRecord
}

// ===== Builder State (Pure Functions Pattern) =====

/**
 * ItemStackBuilderの状態型定義
 */
export type ItemStackBuilderState = {
  readonly id?: ItemStackId
  readonly itemId?: ItemId
  readonly count?: ItemCount
  readonly durability?: Durability
  readonly nbtData: ItemNBTData
  readonly metadata: JsonRecord
  readonly version: number
  readonly createdAt?: string
  readonly lastModified?: string
}

/**
 * 初期状態
 */
export const initialItemStackBuilderState: ItemStackBuilderState = {
  nbtData: {},
  metadata: {},
  version: ITEM_STACK_CONSTANTS.DEFAULT_VERSION,
}

/**
 * アイテムIDを設定
 */
export const withItemId = (state: ItemStackBuilderState, itemId: ItemId): ItemStackBuilderState => ({
  ...state,
  itemId,
})

/**
 * カウントを設定
 */
export const withCount = (state: ItemStackBuilderState, count: ItemCount): ItemStackBuilderState => ({
  ...state,
  count,
})

/**
 * カスタムIDを設定（テスト用）
 */
export const withId = (state: ItemStackBuilderState, id: ItemStackId): ItemStackBuilderState => ({
  ...state,
  id,
})

/**
 * 耐久度を設定
 */
export const withDurability = (state: ItemStackBuilderState, durability: Durability): ItemStackBuilderState => ({
  ...state,
  durability,
})

/**
 * NBTデータを設定
 */
export const withNBTData = (state: ItemStackBuilderState, nbtData: ItemNBTData): ItemStackBuilderState => ({
  ...state,
  nbtData: { ...state.nbtData, ...nbtData },
})

/**
 * エンチャントを追加
 */
export const withEnchantment = (state: ItemStackBuilderState, enchantment: Enchantment): ItemStackBuilderState => ({
  ...state,
  nbtData: {
    ...state.nbtData,
    enchantments: [...(state.nbtData.enchantments ?? []), enchantment],
  },
})

/**
 * カスタム名を設定
 */
export const withCustomName = (state: ItemStackBuilderState, name: string): ItemStackBuilderState => ({
  ...state,
  nbtData: {
    ...state.nbtData,
    customName: name,
  },
})

/**
 * 説明文を追加
 */
export const withLore = (state: ItemStackBuilderState, lore: string): ItemStackBuilderState => ({
  ...state,
  nbtData: {
    ...state.nbtData,
    lore: [...(state.nbtData.lore ?? []), lore],
  },
})

/**
 * 破壊不能フラグを設定
 */
export const withUnbreakable = (state: ItemStackBuilderState, unbreakable: boolean): ItemStackBuilderState => ({
  ...state,
  nbtData: {
    ...state.nbtData,
    unbreakable,
  },
})

/**
 * カスタムモデルデータを設定
 */
export const withCustomModelData = (state: ItemStackBuilderState, modelData: number): ItemStackBuilderState => ({
  ...state,
  nbtData: {
    ...state.nbtData,
    customModelData: modelData,
  },
})

/**
 * タグを追加
 */
export const withTag = (state: ItemStackBuilderState, tag: string): ItemStackBuilderState => ({
  ...state,
  nbtData: {
    ...state.nbtData,
    tags: [...(state.nbtData.tags ?? []), tag],
  },
})

/**
 * メタデータを設定
 */
export const withMetadata = (state: ItemStackBuilderState, metadata: JsonRecord): ItemStackBuilderState => ({
  ...state,
  metadata: { ...state.metadata, ...metadata },
})

/**
 * バージョンを設定
 */
export const withVersion = (state: ItemStackBuilderState, version: number): ItemStackBuilderState => ({
  ...state,
  version,
})

/**
 * エンティティをビルド
 */
export const buildItemStack = (state: ItemStackBuilderState): Effect.Effect<ItemStackEntity, ItemStackError> =>
  Effect.gen(function* () {
    const requireField = <T>(value: T | undefined, message: string, reason: ItemStackError['_tag']) =>
      pipe(
        Match.value(value),
        Match.when(
          (candidate): candidate is T => candidate !== undefined,
          (candidate) => Effect.succeed(candidate)
        ),
        Match.orElse(() =>
          Effect.fail(
            ItemStackError.make({
              reason,
              message,
            })
          )
        )
      )

    const itemId = yield* requireField(state.itemId, 'アイテムIDが設定されていません', 'INCOMPATIBLE_ITEMS')
    const count = yield* requireField(state.count, 'アイテム数量が設定されていません', 'INVALID_STACK_SIZE')

    // IDの生成または検証
    const id = state.id ?? makeUnsafeItemStackId(`stack_${nanoid()}`)

    // タイムスタンプの生成（未設定の場合）
    const now = yield* DateTime.now
    const timestamp = DateTime.formatIso(now)
    const createdAt = state.createdAt ?? timestamp
    const lastModified = state.lastModified ?? timestamp

    // エンティティデータの構築
    const entityData = {
      id,
      itemId,
      count,
      ...(state.durability && { durability: state.durability }),
      ...(Object.keys(state.metadata).length > 0 && { metadata: state.metadata }),
      ...(Object.keys(state.nbtData).length > 0 && { nbtData: state.nbtData }),
      createdAt,
      lastModified,
      version: state.version,
    }

    // スキーマ検証
    const entity = yield* Schema.decodeUnknown(ItemStackEntitySchema)(entityData).pipe(
      Effect.mapError((parseError: Schema.ParseError) =>
        ItemStackError.make({
          reason: 'INCOMPATIBLE_ITEMS',
          message: 'ItemStackエンティティの検証に失敗',
          issues: formatParseIssues(parseError),
          originalError: parseError,
        })
      )
    )

    return entity
  })

// ===== Factory Implementation =====

export const ItemStackFactoryLive = ItemStackFactory.of({
  create: (itemId: ItemId, count: ItemCount, options?: ItemStackCreateOptions) =>
    Effect.gen(function* () {
      let state = initialItemStackBuilderState
      state = withItemId(state, itemId)
      state = withCount(state, count)

      state = pipe(
        Option.fromNullable(options),
        Option.match({
          onNone: () => state,
          onSome: (opts) => {
            const withIdState = pipe(
              Match.value(opts.id),
              Match.when(
                (value): value is ItemStackId => value !== undefined,
                (value) => withId(state, value)
              ),
              Match.orElse(() => state)
            )

            const withDurabilityState = pipe(
              Match.value(opts.durability),
              Match.when(
                (value): value is Durability => value !== undefined,
                (value) => withDurability(withIdState, value)
              ),
              Match.orElse(() => withIdState)
            )

            const withNBTState = pipe(
              Match.value(opts.nbtData),
              Match.when(
                (value): value is ItemNBTData => value !== undefined,
                (value) => withNBTData(withDurabilityState, value)
              ),
              Match.orElse(() => withDurabilityState)
            )

            return pipe(
              Match.value(opts.metadata),
              Match.when(
                (value): value is JsonRecord => value !== undefined,
                (value) => withMetadata(withNBTState, value)
              ),
              Match.orElse(() => withNBTState)
            )
          },
        })
      )

      return yield* buildItemStack(state)
    }),

  restore: (data: PersistedItemStack) =>
    Effect.gen(function* () {
      // スキーマ検証による安全な復元
      // ParseErrorの構造化情報を保持してエラー診断を容易にする
      return yield* Schema.decodeUnknown(ItemStackEntitySchema)(data).pipe(
        Effect.mapError((parseError: Schema.ParseError) =>
          ItemStackError.make({
            reason: 'INCOMPATIBLE_ITEMS',
            message: `データからの復元に失敗: Schema検証エラー`,
            metadata: {
              issues: formatParseIssues(parseError),
              parseError: String(parseError),
            },
          })
        )
      )
    }),
})

/**
 * ItemStackFactory Layer
 */
export const ItemStackFactoryLayer = Layer.succeed(ItemStackFactory, ItemStackFactoryLive)

// ===== Utility Functions =====

/**
 * 簡単なItemStackエンティティを作成
 */
export const createSimpleItemStack = (itemId: ItemId, count: number): Effect.Effect<ItemStackEntity, ItemStackError> =>
  Effect.gen(function* () {
    const validCount = yield* Schema.decodeUnknown(ItemCountSchema)(count).pipe(
      Effect.mapError((error) => ItemStackError.invalidStackSize(makeUnsafeItemStackId(`stack_${nanoid()}`), count))
    )

    const factory = yield* ItemStackFactory
    return yield* factory.create(itemId, validCount)
  })

/**
 * 耐久度付きのItemStackエンティティを作成
 */
export const createDurableItemStack = (
  itemId: ItemId,
  count: number,
  durability: number
): Effect.Effect<ItemStackEntity, ItemStackError> =>
  Effect.gen(function* () {
    const validCount = yield* Schema.decodeUnknown(ItemCountSchema)(count).pipe(
      Effect.mapError((error) => ItemStackError.invalidStackSize(makeUnsafeItemStackId(`stack_${nanoid()}`), count))
    )

    const validDurability = yield* Schema.decodeUnknown(
      Schema.Number.pipe(Schema.between(0, 1), Schema.brand('Durability'))
    )(durability).pipe(
      Effect.mapError(() =>
        ItemStackError.make({
          reason: 'INVALID_DURABILITY',
          message: `不正な耐久度: ${durability}`,
        })
      )
    )

    const factory = yield* ItemStackFactory
    return yield* factory.create(itemId, validCount, {
      durability: validDurability,
    })
  })

/**
 * エンチャント付きのItemStackエンティティを作成
 */
export const createEnchantedItemStack = (
  itemId: ItemId,
  count: number,
  enchantments: ReadonlyArray<Enchantment>
): Effect.Effect<ItemStackEntity, ItemStackError> =>
  Effect.gen(function* () {
    const validCount = yield* Schema.decodeUnknown(ItemCountSchema)(count).pipe(
      Effect.mapError((error) => ItemStackError.invalidStackSize(makeUnsafeItemStackId(`stack_${nanoid()}`), count))
    )

    const factory = yield* ItemStackFactory
    return yield* factory.create(itemId, validCount, {
      nbtData: {
        enchantments: [...enchantments],
      },
    })
  })

/**
 * エンティティのバージョンを増加
 */
export const incrementEntityVersion = (entity: ItemStackEntity): Effect.Effect<ItemStackEntity> =>
  Effect.gen(function* () {
    const nowDateTime = yield* DateTime.now
    const lastModified = DateTime.formatIso(nowDateTime)
    return {
      ...entity,
      version: entity.version + 1,
      lastModified,
    }
  })
