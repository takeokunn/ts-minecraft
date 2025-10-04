/**
 * ItemBuilder - Function.flow Builder Pattern Implementation for ItemStack
 *
 * Effect-TSの関数型BuilderパターンによるItemStack構築システム
 * class構文を使用せず、純粋関数とFunction.flowチェーンで実装
 */

import { Effect, Function, Match, Option, pipe } from 'effect'
import * as RA from 'effect/Array'
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
const issueWhen = (condition: boolean, message: string): Option.Option<string> =>
  condition ? Option.some(message) : Option.none()

const validateBuilderConfig = (config: ItemBuilderConfig): Effect.Effect<void, ItemValidationError> =>
  pipe(
    [
      issueWhen(config.itemId === undefined, 'itemId is required'),
      pipe(
        Option.fromNullable(config.count),
        Option.flatMap((value) => issueWhen(value < 1 || value > 64, 'count must be between 1 and 64'))
      ),
      pipe(
        Option.fromNullable(config.durability),
        Option.flatMap((value) => issueWhen(value < 0 || value > 1, 'durability must be between 0 and 1'))
      ),
      pipe(
        Option.fromNullable(config.maxStackSize),
        Option.flatMap((value) => issueWhen(value < 1 || value > 64, 'maxStackSize must be between 1 and 64'))
      ),
    ],
    RA.filterMap(Function.identity),
    RA.match({
      onEmpty: () => Effect.void,
      onNonEmpty: (issues) =>
        Effect.fail(
          new ValidationError({
            reason: 'Builder configuration validation failed',
            missingFields: [...issues],
            context: { config },
          })
        ),
    })
  )

// ===== Function.flow Builder Implementation =====

const applyCategory = (category: ItemCategory, config: ItemBuilderConfig): ItemBuilderConfig => ({
  ...getCategoryDefaultConfig(category),
  ...config,
  category,
})

const normalizeEnchantments = (
  enchantments: ReadonlyArray<EnchantmentDefinition> | undefined,
  enchantment: EnchantmentDefinition
): ReadonlyArray<EnchantmentDefinition> =>
  pipe(
    enchantments ?? [],
    RA.filter((existing) => existing.id !== enchantment.id),
    (remaining) => [...remaining, enchantment]
  )

const pruneEnchantments = (
  enchantments: ReadonlyArray<EnchantmentDefinition> | undefined,
  enchantmentId: string
): ReadonlyArray<EnchantmentDefinition> | undefined =>
  pipe(
    enchantments ?? [],
    RA.filter((entry) => entry.id !== enchantmentId),
    (remaining) => (remaining.length > 0 ? remaining : undefined)
  )

const makeBuilder = (config: ItemBuilderConfig): ItemBuilder => {
  const update = (modify: (current: ItemBuilderConfig) => ItemBuilderConfig) => makeBuilder(modify(config))

  return {
    withItemId: (itemId) => update((current) => ({ ...current, itemId })),
    withCount: (count) => update((current) => ({ ...current, count })),
    withCategory: (category) => update((current) => applyCategory(category, current)),
    withQuality: (quality) => update((current) => ({ ...current, quality })),
    withRarity: (rarity) => update((current) => ({ ...current, rarity })),
    withDurability: (durability, maxDurability) =>
      update((current) => ({
        ...current,
        durability,
        maxDurability: pipe(Option.fromNullable(maxDurability), Option.getOrElse(() => current.maxDurability)),
      })),
    withCustomName: (name) => update((current) => ({ ...current, customName: name })),
    withLore: (lore) => update((current) => ({ ...current, lore })),
    addLoreLine: (line) =>
      update((current) => ({
        ...current,
        lore: [...(current.lore ?? []), line],
      })),
    withNBT: (nbtData) => update((current) => ({ ...current, nbtData })),
    withStackable: (stackable, maxStackSize) =>
      update((current) => ({
        ...current,
        stackable,
        maxStackSize: pipe(Option.fromNullable(maxStackSize), Option.getOrElse(() => (stackable ? 64 : 1))),
      })),
    addEnchantment: (enchantment) =>
      update((current) => ({
        ...current,
        enchantments: normalizeEnchantments(current.enchantments, enchantment),
      })),
    removeEnchantment: (enchantmentId) =>
      update((current) => ({
        ...current,
        enchantments: pruneEnchantments(current.enchantments, enchantmentId),
      })),
    build: () =>
      pipe(
        validateBuilderConfig(config),
        Effect.flatMap(() =>
          pipe(
            Option.fromNullable(config.itemId),
            Option.match({
              onNone: () =>
                Effect.fail(
                  new CreationError({
                    reason: 'Missing required fields for build',
                    invalidFields: ['itemId'],
                    context: { config },
                  })
                ),
              onSome: (itemId) =>
                ItemFactoryLive.createWithConfig({
                  itemId,
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
                }),
            })
          )
        )
      ),
    validate: () => validateBuilderConfig(config),
    reset: () => createItemBuilder(),
  }
}

export const createItemBuilder = (initialConfig: ItemBuilderConfig = {}): ItemBuilder =>
  makeBuilder({ ...initialConfig })

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
    (builder) =>
      pipe(
        enchantments,
        RA.reduce(builder, (acc, enchant) => acc.addEnchantment(enchant))
      )
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
    (builder) =>
      pipe(
        [
          pipe(
            Option.fromNullable(customizations.count),
            Option.map((value) => (current: ItemBuilder) => current.withCount(value))
          ),
          pipe(
            Option.fromNullable(customizations.quality),
            Option.map((value) => (current: ItemBuilder) => current.withQuality(value))
          ),
          pipe(
            Option.fromNullable(customizations.rarity),
            Option.map((value) => (current: ItemBuilder) => current.withRarity(value))
          ),
          pipe(
            Option.fromNullable(customizations.durability),
            Option.map((value) => (current: ItemBuilder) =>
              current.withDurability(value, customizations.maxDurability)
            )
          ),
          pipe(
            Option.fromNullable(customizations.customName),
            Option.map((value) => (current: ItemBuilder) => current.withCustomName(value))
          ),
          pipe(
            Option.fromNullable(customizations.lore),
            Option.map((value) => (current: ItemBuilder) => current.withLore(value))
          ),
          pipe(
            Option.fromNullable(customizations.nbtData),
            Option.map((value) => (current: ItemBuilder) => current.withNBT(value))
          ),
          pipe(
            Option.fromNullable(customizations.stackable),
            Option.map((value) => (current: ItemBuilder) =>
              current.withStackable(value, customizations.maxStackSize)
            )
          ),
        ],
        RA.filterMap(Function.identity),
        RA.reduce(builder, (acc, apply) => apply(acc))
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
      (builder) =>
        pipe(
          Option.fromNullable(item.metadata?.enchantments),
          Option.match({
            onNone: () => builder,
            onSome: (enchantments) =>
              pipe(
                enchantments,
                RA.reduce(builder, (acc, enchant) =>
                  acc.addEnchantment({
                    id: enchant.id,
                    name: enchant.id,
                    level: enchant.level,
                    maxLevel: enchant.level,
                  })
                )
              ),
          })
        )
    ),

  // 設定からビルダー作成
  fromConfig: (config) => createItemBuilder(config),

  // デフォルト付きビルダー作成
  createWithDefaults: (category) =>
    Effect.succeed(createItemBuilder(getCategoryDefaultConfig(category))),
}

// Layer.effect による依存性注入実装
export const ItemBuilderFactoryLayer = Effect.succeed(ItemBuilderFactoryLive)
