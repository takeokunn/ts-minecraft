/**
 * ItemBuilder - Function.flow Builder Pattern Implementation for ItemStack
 *
 * Effect-TSの関数型BuilderパターンによるItemStack構築システム
 * class構文を使用せず、純粋関数とFunction.flowチェーンで実装
 */

import { Effect, Function, Match, pipe } from 'effect'
import type { ItemId } from '../../types'
import { ItemFactoryLive } from './factory'
import type {
  EnchantmentDefinition,
  ItemBuilder,
  ItemBuilderConfig,
  ItemBuilderFactory,
  ItemCategory,
  ItemQuality,
  ItemRarity,
  ItemValidationError,
} from './interface'
import { ItemCreationError as CreationError, ItemValidationError as ValidationError } from './interface'

// ===== Builder Configuration Helpers（Pure Functions） =====

// カテゴリ別デフォルト設定取得（Match.valueパターン）
const getCategoryDefaultConfig = (category: ItemCategory): ItemBuilderConfig =>
  pipe(
    category,
    Match.value,
    Match.when('tool', () => ({
      category: 'tool' as ItemCategory,
      stackable: false,
      maxStackSize: 1,
      durability: 1.0,
      maxDurability: 100,
      quality: 'common' as ItemQuality,
      rarity: 'common' as ItemRarity,
      count: 1,
    })),
    Match.when('weapon', () => ({
      category: 'weapon' as ItemCategory,
      stackable: false,
      maxStackSize: 1,
      durability: 1.0,
      maxDurability: 150,
      quality: 'common' as ItemQuality,
      rarity: 'common' as ItemRarity,
      count: 1,
    })),
    Match.when('armor', () => ({
      category: 'armor' as ItemCategory,
      stackable: false,
      maxStackSize: 1,
      durability: 1.0,
      maxDurability: 200,
      quality: 'common' as ItemQuality,
      rarity: 'common' as ItemRarity,
      count: 1,
    })),
    Match.when('food', () => ({
      category: 'food' as ItemCategory,
      stackable: true,
      maxStackSize: 16,
      quality: 'common' as ItemQuality,
      rarity: 'common' as ItemRarity,
      count: 1,
    })),
    Match.when('block', () => ({
      category: 'block' as ItemCategory,
      stackable: true,
      maxStackSize: 64,
      quality: 'common' as ItemQuality,
      rarity: 'common' as ItemRarity,
      count: 1,
    })),
    Match.when('resource', () => ({
      category: 'resource' as ItemCategory,
      stackable: true,
      maxStackSize: 64,
      quality: 'common' as ItemQuality,
      rarity: 'common' as ItemRarity,
      count: 1,
    })),
    Match.when('consumable', () => ({
      category: 'consumable' as ItemCategory,
      stackable: true,
      maxStackSize: 8,
      quality: 'common' as ItemQuality,
      rarity: 'common' as ItemRarity,
      count: 1,
    })),
    Match.when('redstone', () => ({
      category: 'redstone' as ItemCategory,
      stackable: true,
      maxStackSize: 64,
      quality: 'common' as ItemQuality,
      rarity: 'common' as ItemRarity,
      count: 1,
    })),
    Match.when('decoration', () => ({
      category: 'decoration' as ItemCategory,
      stackable: true,
      maxStackSize: 64,
      quality: 'common' as ItemQuality,
      rarity: 'common' as ItemRarity,
      count: 1,
    })),
    Match.when('misc', () => ({
      category: 'misc' as ItemCategory,
      stackable: true,
      maxStackSize: 64,
      quality: 'common' as ItemQuality,
      rarity: 'common' as ItemRarity,
      count: 1,
    })),
    Match.exhaustive
  )

// Builder設定の検証（Pure Function with Effect）
const validateBuilderConfig = (config: ItemBuilderConfig): Effect.Effect<void, ItemValidationError> =>
  Effect.gen(function* () {
    const errors: string[] = []

    if (!config.itemId) {
      errors.push('itemId is required')
    }

    if (config.count !== undefined && (config.count < 1 || config.count > 64)) {
      errors.push('count must be between 1 and 64')
    }

    if (config.durability !== undefined && (config.durability < 0 || config.durability > 1)) {
      errors.push('durability must be between 0 and 1')
    }

    if (config.maxStackSize !== undefined && (config.maxStackSize < 1 || config.maxStackSize > 64)) {
      errors.push('maxStackSize must be between 1 and 64')
    }

    if (errors.length > 0) {
      return yield* Effect.fail(
        new ValidationError({
          reason: 'Builder configuration validation failed',
          missingFields: errors,
          context: { config },
        })
      )
    }

    return yield* Effect.void
  })

// ===== Function.flow Builder Implementation =====

// Builder関数型実装（Immutable State Pattern）
export const createItemBuilder = (initialConfig: ItemBuilderConfig = {}): ItemBuilder => {
  let config: ItemBuilderConfig = { ...initialConfig }

  const builder: ItemBuilder = {
    // ItemId設定（Function.flow チェーン対応）
    withItemId: (itemId) => {
      config = { ...config, itemId }
      return createItemBuilder(config)
    },

    // 数量設定
    withCount: (count) => {
      config = { ...config, count }
      return createItemBuilder(config)
    },

    // カテゴリ設定（Match.valueによるデフォルト適用）
    withCategory: (category) => {
      const defaults = getCategoryDefaultConfig(category)
      config = { ...defaults, ...config, category }
      return createItemBuilder(config)
    },

    // 品質設定
    withQuality: (quality) => {
      config = { ...config, quality }
      return createItemBuilder(config)
    },

    // レアリティ設定
    withRarity: (rarity) => {
      config = { ...config, rarity }
      return createItemBuilder(config)
    },

    // 耐久度設定（最大耐久度も同時設定可能）
    withDurability: (durability, maxDurability) => {
      config = {
        ...config,
        durability,
        maxDurability: maxDurability ?? config.maxDurability,
      }
      return createItemBuilder(config)
    },

    // カスタム名設定
    withCustomName: (name) => {
      config = { ...config, customName: name }
      return createItemBuilder(config)
    },

    // 説明文設定（配列置換）
    withLore: (lore) => {
      config = { ...config, lore }
      return createItemBuilder(config)
    },

    // 説明文行追加（既存配列に追加）
    addLoreLine: (line) => {
      const currentLore = config.lore || []
      config = { ...config, lore: [...currentLore, line] }
      return createItemBuilder(config)
    },

    // NBTデータ設定
    withNBT: (nbtData) => {
      config = { ...config, nbtData }
      return createItemBuilder(config)
    },

    // スタック可能設定（最大スタックサイズも同時設定可能）
    withStackable: (stackable, maxStackSize) => {
      config = {
        ...config,
        stackable,
        maxStackSize: maxStackSize ?? (stackable ? 64 : 1),
      }
      return createItemBuilder(config)
    },

    // エンチャント追加
    addEnchantment: (enchantment) => {
      const currentEnchantments = config.enchantments || []
      // 既存の同じエンチャントを削除してから追加
      const filteredEnchantments = currentEnchantments.filter((e) => e.id !== enchantment.id)
      config = {
        ...config,
        enchantments: [...filteredEnchantments, enchantment],
      }
      return createItemBuilder(config)
    },

    // エンチャント削除
    removeEnchantment: (enchantmentId) => {
      const currentEnchantments = config.enchantments || []
      const filteredEnchantments = currentEnchantments.filter((e) => e.id !== enchantmentId)
      config = {
        ...config,
        enchantments: filteredEnchantments.length > 0 ? filteredEnchantments : undefined,
      }
      return createItemBuilder(config)
    },

    // 最終ビルド実行（Effect.gen with validation）
    build: () =>
      Effect.gen(function* () {
        yield* validateBuilderConfig(config)

        if (!config.itemId) {
          return yield* Effect.fail(
            new CreationError({
              reason: 'Missing required fields for build',
              invalidFields: ['itemId'],
              context: { config },
            })
          )
        }

        const itemConfig = {
          itemId: config.itemId,
          count: config.count ?? 1,
          category: config.category,
          quality: config.quality,
          rarity: config.rarity,
          durability: config.durability,
          maxDurability: config.maxDurability,
          enchantments: config.enchantments,
          customName: config.customName,
          lore: config.lore,
          nbtData: config.nbtData,
          stackable: config.stackable,
          maxStackSize: config.maxStackSize,
        }

        return yield* ItemFactoryLive.createWithConfig(itemConfig)
      }),

    // 検証実行（ビルド前の事前検証）
    validate: () => validateBuilderConfig(config),

    // リセット（初期状態に戻す）
    reset: () => createItemBuilder(),
  }

  return builder
}

// ===== Function.flow チェーン用ヘルパー関数 =====

// ツールビルダー（Function.flowチェーン）
export const toolItemBuilder = (itemId: ItemId, durability = 1.0) =>
  pipe(
    createItemBuilder(),
    (builder) => builder.withItemId(itemId),
    (builder) => builder.withCategory('tool'),
    (builder) => builder.withDurability(durability)
  )

// 武器ビルダー（Function.flowチェーン）
export const weaponItemBuilder = (itemId: ItemId, durability = 1.0) =>
  pipe(
    createItemBuilder(),
    (builder) => builder.withItemId(itemId),
    (builder) => builder.withCategory('weapon'),
    (builder) => builder.withDurability(durability)
  )

// 防具ビルダー（Function.flowチェーン）
export const armorItemBuilder = (itemId: ItemId, durability = 1.0) =>
  pipe(
    createItemBuilder(),
    (builder) => builder.withItemId(itemId),
    (builder) => builder.withCategory('armor'),
    (builder) => builder.withDurability(durability)
  )

// 食料ビルダー（Function.flowチェーン）
export const foodItemBuilder = (itemId: ItemId, count = 1) =>
  pipe(
    createItemBuilder(),
    (builder) => builder.withItemId(itemId),
    (builder) => builder.withCategory('food'),
    (builder) => builder.withCount(count)
  )

// ブロックビルダー（Function.flowチェーン）
export const blockItemBuilder = (itemId: ItemId, count = 1) =>
  pipe(
    createItemBuilder(),
    (builder) => builder.withItemId(itemId),
    (builder) => builder.withCategory('block'),
    (builder) => builder.withCount(count)
  )

// エンチャント付きアイテムビルダー（Function.flowチェーン）
export const enchantedItemBuilder = (
  itemId: ItemId,
  category: ItemCategory,
  enchantments: ReadonlyArray<EnchantmentDefinition>
) =>
  pipe(
    createItemBuilder(),
    (builder) => builder.withItemId(itemId),
    (builder) => builder.withCategory(category),
    Function.flow(...enchantments.map((enchant) => (builder: ItemBuilder) => builder.addEnchantment(enchant)))
  )

// カスタムアイテムビルダー（設定ベース）
export const customItemBuilder = (
  itemId: ItemId,
  category: ItemCategory,
  customizations: Partial<ItemBuilderConfig> = {}
) =>
  pipe(
    createItemBuilder(),
    (builder) => builder.withItemId(itemId),
    (builder) => builder.withCategory(category),
    Function.flow(
      // カスタマイゼーション適用
      (builder) => (customizations.count ? builder.withCount(customizations.count) : builder),
      (builder) => (customizations.quality ? builder.withQuality(customizations.quality) : builder),
      (builder) => (customizations.rarity ? builder.withRarity(customizations.rarity) : builder),
      (builder) =>
        customizations.durability !== undefined
          ? builder.withDurability(customizations.durability, customizations.maxDurability)
          : builder,
      (builder) => (customizations.customName ? builder.withCustomName(customizations.customName) : builder),
      (builder) => (customizations.lore ? builder.withLore(customizations.lore) : builder),
      (builder) => (customizations.nbtData ? builder.withNBT(customizations.nbtData) : builder),
      (builder) =>
        customizations.stackable !== undefined
          ? builder.withStackable(customizations.stackable, customizations.maxStackSize)
          : builder
    )
  )

// ===== Builder Factory Implementation =====

export const ItemBuilderFactoryLive: ItemBuilderFactory = {
  // 空のビルダー作成
  create: () => createItemBuilder(),

  // 既存ItemStackからビルダー作成
  fromItemStack: (item) =>
    pipe(
      createItemBuilder(),
      (builder) => builder.withItemId(item.itemId),
      (builder) => builder.withCount(item.count),
      (builder) => (item.durability !== undefined ? builder.withDurability(item.durability) : builder),
      (builder) => (item.metadata?.customName ? builder.withCustomName(item.metadata.customName) : builder),
      (builder) => (item.metadata?.lore ? builder.withLore(item.metadata.lore) : builder),
      (builder) => {
        if (!item.metadata?.enchantments) return builder

        let builderWithEnchants = builder
        for (const enchant of item.metadata.enchantments) {
          builderWithEnchants = builderWithEnchants.addEnchantment({
            id: enchant.id,
            name: enchant.id, // 簡易変換
            level: enchant.level,
            maxLevel: enchant.level, // 推定値
          })
        }
        return builderWithEnchants
      }
    ),

  // 設定からビルダー作成
  fromConfig: (config) => createItemBuilder(config),

  // デフォルト付きビルダー作成
  createWithDefaults: (category) =>
    Effect.gen(function* () {
      const defaults = getCategoryDefaultConfig(category)
      return yield* Effect.succeed(createItemBuilder(defaults))
    }),
}

// Layer.effect による依存性注入実装
export const ItemBuilderFactoryLayer = Effect.succeed(ItemBuilderFactoryLive)
