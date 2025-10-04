/**
 * @fileoverview ItemStackエンティティファクトリ
 * DDD原則に基づく複雑なエンティティ生成の隠蔽
 */

import { Context, Effect, Schema } from 'effect'
import { nanoid } from 'nanoid'
import type { ItemId } from '../../types.js'
import type { Durability, Enchantment, ItemCount, ItemNBTData, ItemStackEntity, ItemStackId } from './types.js'
import { ITEM_STACK_CONSTANTS, ItemCountSchema, ItemStackEntitySchema, ItemStackError } from './types.js'

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
   */
  readonly restore: (data: unknown) => Effect.Effect<ItemStackEntity, ItemStackError>

  /**
   * ItemStackエンティティのビルダーを作成
   */
  readonly builder: () => ItemStackBuilder
}

export const ItemStackFactory = Context.GenericTag<ItemStackFactory>(
  '@minecraft/domain/inventory/aggregate/ItemStackFactory'
)

// ===== Builder Options =====

export interface ItemStackCreateOptions {
  readonly id?: ItemStackId
  readonly durability?: Durability
  readonly nbtData?: ItemNBTData
  readonly metadata?: Record<string, unknown>
}

// ===== Builder Pattern Implementation =====

export interface ItemStackBuilder {
  /**
   * アイテムIDを設定
   */
  readonly setItemId: (itemId: ItemId) => ItemStackBuilder

  /**
   * カウントを設定
   */
  readonly setCount: (count: ItemCount) => ItemStackBuilder

  /**
   * カスタムIDを設定（テスト用）
   */
  readonly setId: (id: ItemStackId) => ItemStackBuilder

  /**
   * 耐久度を設定
   */
  readonly setDurability: (durability: Durability) => ItemStackBuilder

  /**
   * NBTデータを設定
   */
  readonly setNBTData: (nbtData: ItemNBTData) => ItemStackBuilder

  /**
   * エンチャントを追加
   */
  readonly addEnchantment: (enchantment: Enchantment) => ItemStackBuilder

  /**
   * カスタム名を設定
   */
  readonly setCustomName: (name: string) => ItemStackBuilder

  /**
   * 説明文を追加
   */
  readonly addLore: (lore: string) => ItemStackBuilder

  /**
   * 破壊不能フラグを設定
   */
  readonly setUnbreakable: (unbreakable: boolean) => ItemStackBuilder

  /**
   * カスタムモデルデータを設定
   */
  readonly setCustomModelData: (modelData: number) => ItemStackBuilder

  /**
   * タグを追加
   */
  readonly addTag: (tag: string) => ItemStackBuilder

  /**
   * メタデータを設定
   */
  readonly setMetadata: (metadata: Record<string, unknown>) => ItemStackBuilder

  /**
   * バージョンを設定
   */
  readonly setVersion: (version: number) => ItemStackBuilder

  /**
   * エンティティをビルド
   */
  readonly build: () => Effect.Effect<ItemStackEntity, ItemStackError>
}

// ===== Builder Implementation =====

class ItemStackBuilderImpl implements ItemStackBuilder {
  private id: ItemStackId | null = null
  private itemId: ItemId | null = null
  private count: ItemCount | null = null
  private durability: Durability | null = null
  private nbtData: ItemNBTData = {}
  private metadata: Record<string, unknown> = {}
  private version: number = ITEM_STACK_CONSTANTS.DEFAULT_VERSION
  private createdAt: Date = new Date()
  private lastModified: Date = new Date()

  setItemId(itemId: ItemId): ItemStackBuilder {
    this.itemId = itemId
    return this
  }

  setCount(count: ItemCount): ItemStackBuilder {
    this.count = count
    return this
  }

  setId(id: ItemStackId): ItemStackBuilder {
    this.id = id
    return this
  }

  setDurability(durability: Durability): ItemStackBuilder {
    this.durability = durability
    return this
  }

  setNBTData(nbtData: ItemNBTData): ItemStackBuilder {
    this.nbtData = { ...this.nbtData, ...nbtData }
    return this
  }

  addEnchantment(enchantment: Enchantment): ItemStackBuilder {
    if (!this.nbtData.enchantments) {
      this.nbtData.enchantments = []
    }
    this.nbtData.enchantments = [...this.nbtData.enchantments, enchantment]
    return this
  }

  setCustomName(name: string): ItemStackBuilder {
    this.nbtData.customName = name
    return this
  }

  addLore(lore: string): ItemStackBuilder {
    if (!this.nbtData.lore) {
      this.nbtData.lore = []
    }
    this.nbtData.lore = [...this.nbtData.lore, lore]
    return this
  }

  setUnbreakable(unbreakable: boolean): ItemStackBuilder {
    this.nbtData.unbreakable = unbreakable
    return this
  }

  setCustomModelData(modelData: number): ItemStackBuilder {
    this.nbtData.customModelData = modelData
    return this
  }

  addTag(tag: string): ItemStackBuilder {
    if (!this.nbtData.tags) {
      this.nbtData.tags = []
    }
    this.nbtData.tags = [...this.nbtData.tags, tag]
    return this
  }

  setMetadata(metadata: Record<string, unknown>): ItemStackBuilder {
    this.metadata = { ...this.metadata, ...metadata }
    return this
  }

  setVersion(version: number): ItemStackBuilder {
    this.version = version
    return this
  }

  build(): Effect.Effect<ItemStackEntity, ItemStackError> {
    return Effect.gen(
      function* () {
        // 必須フィールドの検証
        if (!this.itemId) {
          yield* Effect.fail(
            new ItemStackError({
              reason: 'INCOMPATIBLE_ITEMS',
              message: 'アイテムIDが設定されていません',
            })
          )
        }

        if (!this.count) {
          yield* Effect.fail(
            new ItemStackError({
              reason: 'INVALID_STACK_SIZE',
              message: 'アイテム数量が設定されていません',
            })
          )
        }

        // IDの生成または検証
        const id = this.id ?? (`stack_${nanoid()}` as ItemStackId)

        // エンティティデータの構築
        const entityData = {
          id,
          itemId: this.itemId,
          count: this.count,
          ...(this.durability && { durability: this.durability }),
          ...(Object.keys(this.metadata).length > 0 && { metadata: this.metadata }),
          ...(Object.keys(this.nbtData).length > 0 && { nbtData: this.nbtData }),
          createdAt: this.createdAt.toISOString(),
          lastModified: this.lastModified.toISOString(),
          version: this.version,
        }

        // スキーマ検証
        const entity = yield* Schema.decodeUnknown(ItemStackEntitySchema)(entityData).pipe(
          Effect.mapError(
            (error) =>
              new ItemStackError({
                reason: 'INCOMPATIBLE_ITEMS',
                message: `ItemStackエンティティの検証に失敗: ${String(error)}`,
              })
          )
        )

        return entity
      }.bind(this)
    )
  }
}

// ===== Factory Implementation =====

export const ItemStackFactoryLive = ItemStackFactory.of({
  create: (itemId: ItemId, count: ItemCount, options?: ItemStackCreateOptions) =>
    Effect.gen(function* () {
      const builder = new ItemStackBuilderImpl()

      let builderWithBasics = builder.setItemId(itemId).setCount(count)

      if (options?.id) {
        builderWithBasics = builderWithBasics.setId(options.id)
      }

      if (options?.durability) {
        builderWithBasics = builderWithBasics.setDurability(options.durability)
      }

      if (options?.nbtData) {
        builderWithBasics = builderWithBasics.setNBTData(options.nbtData)
      }

      if (options?.metadata) {
        builderWithBasics = builderWithBasics.setMetadata(options.metadata)
      }

      return yield* builderWithBasics.build()
    }),

  restore: (data: unknown) =>
    Effect.gen(function* () {
      // スキーマ検証による安全な復元
      return yield* Schema.decodeUnknown(ItemStackEntitySchema)(data).pipe(
        Effect.mapError(
          (error) =>
            new ItemStackError({
              reason: 'INCOMPATIBLE_ITEMS',
              message: `データからの復元に失敗: ${String(error)}`,
            })
        )
      )
    }),

  builder: () => new ItemStackBuilderImpl(),
})

// ===== Utility Functions =====

/**
 * 簡単なItemStackエンティティを作成
 */
export const createSimpleItemStack = (itemId: ItemId, count: number): Effect.Effect<ItemStackEntity, ItemStackError> =>
  Effect.gen(function* () {
    const validCount = yield* Schema.decodeUnknown(ItemCountSchema)(count).pipe(
      Effect.mapError((error) => ItemStackError.invalidStackSize(`stack_${nanoid()}` as ItemStackId, count))
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
      Effect.mapError((error) => ItemStackError.invalidStackSize(`stack_${nanoid()}` as ItemStackId, count))
    )

    const validDurability = yield* Schema.decodeUnknown(
      Schema.Number.pipe(Schema.between(0, 1), Schema.brand('Durability'))
    )(durability).pipe(
      Effect.mapError(
        (error) =>
          new ItemStackError({
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
      Effect.mapError((error) => ItemStackError.invalidStackSize(`stack_${nanoid()}` as ItemStackId, count))
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
export const incrementEntityVersion = (entity: ItemStackEntity): ItemStackEntity => ({
  ...entity,
  version: entity.version + 1,
  lastModified: new Date().toISOString() as any,
})
