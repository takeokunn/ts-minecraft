/**
 * ItemFactory - DDD Factory Implementation for ItemStack
 *
 * Effect-TSの関数型パターンによるItemStack生成の純粋関数実装
 * class構文を一切使用せず、pipe/flowによる関数合成とEffect.genで実装
 */

import { Effect, Match, pipe } from 'effect'
import type { ItemMetadata, ItemStack } from '../../types'
import type {
  EnchantmentDefinition,
  ItemCategory,
  ItemConfig,
  ItemCreationError,
  ItemFactory,
  ItemQuality,
  ItemStackError,
  StackingRules,
  defaultItemConfig,
  defaultStackingRules,
} from './interface'
import {
  ItemCreationError as CreationError,
  ItemStackError as StackError,
  ItemValidationError as ValidationError,
} from './interface'

// ===== 内部ヘルパー関数（Pure Functions） =====

// カテゴリ別デフォルト設定（Match.valueパターン）
const getCategoryDefaults = (category: ItemCategory): Partial<ItemConfig> =>
  pipe(
    category,
    Match.value,
    Match.when('tool', () => ({
      stackable: false,
      maxStackSize: 1,
      durability: 1.0,
      maxDurability: 100,
      quality: 'common' as ItemQuality,
    })),
    Match.when('weapon', () => ({
      stackable: false,
      maxStackSize: 1,
      durability: 1.0,
      maxDurability: 150,
      quality: 'common' as ItemQuality,
    })),
    Match.when('armor', () => ({
      stackable: false,
      maxStackSize: 1,
      durability: 1.0,
      maxDurability: 200,
      quality: 'common' as ItemQuality,
    })),
    Match.when('food', () => ({
      stackable: true,
      maxStackSize: 16,
      durability: undefined,
      quality: 'common' as ItemQuality,
    })),
    Match.when('block', () => ({
      stackable: true,
      maxStackSize: 64,
      durability: undefined,
      quality: 'common' as ItemQuality,
    })),
    Match.when('resource', () => ({
      stackable: true,
      maxStackSize: 64,
      durability: undefined,
      quality: 'common' as ItemQuality,
    })),
    Match.when('consumable', () => ({
      stackable: true,
      maxStackSize: 8,
      durability: undefined,
      quality: 'common' as ItemQuality,
    })),
    Match.when('redstone', () => ({
      stackable: true,
      maxStackSize: 64,
      durability: undefined,
      quality: 'common' as ItemQuality,
    })),
    Match.when('decoration', () => ({
      stackable: true,
      maxStackSize: 64,
      durability: undefined,
      quality: 'common' as ItemQuality,
    })),
    Match.when('misc', () => ({
      stackable: true,
      maxStackSize: 64,
      durability: undefined,
      quality: 'common' as ItemQuality,
    })),
    Match.exhaustive
  )

// レアリティ別品質修正（Function.flowパターン）
const applyRarityModifiers = (config: ItemConfig): ItemConfig =>
  pipe(
    config.rarity || 'common',
    Match.value,
    Match.when('common', () => config),
    Match.when('uncommon', () => ({
      ...config,
      maxDurability: config.maxDurability ? Math.floor(config.maxDurability * 1.1) : undefined,
    })),
    Match.when('rare', () => ({
      ...config,
      maxDurability: config.maxDurability ? Math.floor(config.maxDurability * 1.25) : undefined,
    })),
    Match.when('epic', () => ({
      ...config,
      maxDurability: config.maxDurability ? Math.floor(config.maxDurability * 1.5) : undefined,
    })),
    Match.when('legendary', () => ({
      ...config,
      maxDurability: config.maxDurability ? Math.floor(config.maxDurability * 2.0) : undefined,
    })),
    Match.when('mythic', () => ({
      ...config,
      maxDurability: config.maxDurability ? Math.floor(config.maxDurability * 3.0) : undefined,
    })),
    Match.exhaustive
  )

// ItemConfig検証（Pure Function with Effect Error Handling）
const validateItemConfig = (config: ItemConfig): Effect.Effect<void, ItemCreationError> =>
  Effect.gen(function* () {
    const errors: string[] = []

    if (!config.itemId || config.itemId.trim() === '') {
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

    if (config.enchantments) {
      for (const enchant of config.enchantments) {
        if (enchant.level < 1 || enchant.level > enchant.maxLevel) {
          errors.push(`enchantment ${enchant.id} level ${enchant.level} exceeds max level ${enchant.maxLevel}`)
        }
      }
    }

    if (errors.length > 0) {
      return yield* Effect.fail(
        new CreationError({
          reason: 'Invalid item configuration',
          invalidFields: errors,
          context: { config },
        })
      )
    }

    return yield* Effect.void
  })

// ItemMetadata生成（Pure Function）
const createItemMetadata = (config: ItemConfig): ItemMetadata | undefined => {
  const metadata: Partial<ItemMetadata> = {}

  if (config.enchantments && config.enchantments.length > 0) {
    metadata.enchantments = config.enchantments.map((enchant) => ({
      id: enchant.id,
      level: enchant.level,
    }))
  }

  if (config.customName) {
    metadata.customName = config.customName
  }

  if (config.lore && config.lore.length > 0) {
    metadata.lore = [...config.lore]
  }

  if (config.maxDurability && config.durability !== 1.0) {
    metadata.damage = Math.floor((1 - (config.durability || 1.0)) * config.maxDurability)
    metadata.durability = config.maxDurability
  }

  // 空のメタデータは undefined を返す
  return Object.keys(metadata).length > 0 ? (metadata as ItemMetadata) : undefined
}

// エンチャント競合チェック（Pure Function）
const checkEnchantmentConflicts = (
  enchantments: ReadonlyArray<EnchantmentDefinition>
): Effect.Effect<void, ItemCreationError> =>
  Effect.gen(function* () {
    const conflicts: string[] = []

    for (let i = 0; i < enchantments.length; i++) {
      const enchant1 = enchantments[i]
      if (!enchant1.conflictsWith) continue

      for (let j = i + 1; j < enchantments.length; j++) {
        const enchant2 = enchantments[j]
        if (enchant1.conflictsWith.includes(enchant2.id)) {
          conflicts.push(`${enchant1.id} conflicts with ${enchant2.id}`)
        }
      }
    }

    if (conflicts.length > 0) {
      return yield* Effect.fail(
        new CreationError({
          reason: 'Enchantment conflicts detected',
          invalidFields: conflicts,
          context: { enchantments },
        })
      )
    }

    return yield* Effect.void
  })

// スタック結合の検証（Pure Function with Effect）
const validateStackCombination = (
  stack1: ItemStack,
  stack2: ItemStack,
  rules: StackingRules = defaultStackingRules
): Effect.Effect<void, ItemStackError> =>
  Effect.gen(function* () {
    if (!rules.canStack(stack1, stack2)) {
      return yield* Effect.fail(
        new StackError({
          reason: 'Items cannot be stacked together',
          stackingRules: { rule: 'canStack', result: false },
          context: { stack1, stack2 },
        })
      )
    }

    const combinedCount = stack1.count + stack2.count
    const maxSize = rules.maxStackSize(stack1)

    if (combinedCount > maxSize) {
      return yield* Effect.fail(
        new StackError({
          reason: 'Combined count exceeds maximum stack size',
          stackingRules: { maxStackSize: maxSize, attempted: combinedCount },
          context: { stack1, stack2 },
        })
      )
    }

    return yield* Effect.void
  })

// ===== Factory実装（Function.flowとEffect.genパターン） =====

export const ItemFactoryLive: ItemFactory = {
  // 基本生成（Pure Function Factory）
  createBasic: (itemId, count = 1) =>
    Effect.gen(function* () {
      const config: ItemConfig = {
        itemId,
        count,
        ...defaultItemConfig,
      }

      return yield* ItemFactoryLive.createWithConfig(config)
    }),

  // 設定ベース生成（Configuration Pattern）
  createWithConfig: (config) =>
    Effect.gen(function* () {
      yield* validateItemConfig(config)

      // カテゴリ別デフォルトの適用
      const categoryDefaults = config.category ? getCategoryDefaults(config.category) : {}
      let mergedConfig = { ...defaultItemConfig, ...categoryDefaults, ...config }

      // レアリティ修正の適用
      mergedConfig = applyRarityModifiers(mergedConfig)

      // エンチャント競合チェック
      if (mergedConfig.enchantments && mergedConfig.enchantments.length > 0) {
        yield* checkEnchantmentConflicts(mergedConfig.enchantments)
      }

      // ItemMetadata生成
      const metadata = createItemMetadata(mergedConfig)

      const itemStack: ItemStack = {
        itemId: mergedConfig.itemId!,
        count: mergedConfig.count || 1,
        metadata,
        durability: mergedConfig.durability,
      }

      return yield* Effect.succeed(itemStack)
    }),

  // ツール生成
  createTool: (itemId, durability = 1.0, enchantments = []) =>
    Effect.gen(function* () {
      const config: ItemConfig = {
        itemId,
        category: 'tool',
        durability,
        enchantments,
        count: 1,
      }

      return yield* ItemFactoryLive.createWithConfig(config)
    }),

  // 武器生成
  createWeapon: (itemId, durability = 1.0, enchantments = []) =>
    Effect.gen(function* () {
      const config: ItemConfig = {
        itemId,
        category: 'weapon',
        durability,
        enchantments,
        count: 1,
      }

      return yield* ItemFactoryLive.createWithConfig(config)
    }),

  // 防具生成
  createArmor: (itemId, durability = 1.0, enchantments = []) =>
    Effect.gen(function* () {
      const config: ItemConfig = {
        itemId,
        category: 'armor',
        durability,
        enchantments,
        count: 1,
      }

      return yield* ItemFactoryLive.createWithConfig(config)
    }),

  // 食料生成
  createFood: (itemId, count = 1, customEffects = {}) =>
    Effect.gen(function* () {
      const config: ItemConfig = {
        itemId,
        category: 'food',
        count,
        nbtData: Object.keys(customEffects).length > 0 ? customEffects : undefined,
      }

      return yield* ItemFactoryLive.createWithConfig(config)
    }),

  // ブロック生成
  createBlock: (itemId, count = 1) =>
    Effect.gen(function* () {
      const config: ItemConfig = {
        itemId,
        category: 'block',
        count,
      }

      return yield* ItemFactoryLive.createWithConfig(config)
    }),

  // エンチャント追加
  addEnchantment: (item, enchantment) =>
    Effect.gen(function* () {
      const currentEnchantments = item.metadata?.enchantments || []
      const newEnchantments = [
        ...currentEnchantments.filter((e) => e.id !== enchantment.id), // 既存の同じエンチャントを削除
        { id: enchantment.id, level: enchantment.level },
      ]

      const allEnchantments = [
        enchantment,
        ...currentEnchantments.map((e) => ({ ...enchantment, id: e.id, level: e.level })),
      ]
      yield* checkEnchantmentConflicts(allEnchantments)

      const updatedMetadata: ItemMetadata = {
        ...item.metadata,
        enchantments: newEnchantments,
      }

      return yield* Effect.succeed({
        ...item,
        metadata: updatedMetadata,
      })
    }),

  // エンチャント削除
  removeEnchantment: (item, enchantmentId) =>
    Effect.gen(function* () {
      if (!item.metadata?.enchantments) {
        return yield* Effect.succeed(item)
      }

      const filteredEnchantments = item.metadata.enchantments.filter((e) => e.id !== enchantmentId)

      const updatedMetadata: ItemMetadata = {
        ...item.metadata,
        enchantments: filteredEnchantments.length > 0 ? filteredEnchantments : undefined,
      }

      // メタデータが空になった場合は undefined に
      const finalMetadata = Object.values(updatedMetadata).some((v) => v !== undefined) ? updatedMetadata : undefined

      return yield* Effect.succeed({
        ...item,
        metadata: finalMetadata,
      })
    }),

  // スタック結合
  combineStacks: (stack1, stack2) =>
    Effect.gen(function* () {
      yield* validateStackCombination(stack1, stack2)

      const combinedStack: ItemStack = {
        ...stack1,
        count: stack1.count + stack2.count,
      }

      return yield* Effect.succeed(combinedStack)
    }),

  // スタック分割
  splitStack: (stack, amount) =>
    Effect.gen(function* () {
      if (amount <= 0 || amount >= stack.count) {
        return yield* Effect.fail(
          new StackError({
            reason: 'Invalid split amount',
            stackingRules: { originalCount: stack.count, splitAmount: amount },
            context: { stack },
          })
        )
      }

      const remainingStack: ItemStack = {
        ...stack,
        count: stack.count - amount,
      }

      const splitStack: ItemStack = {
        ...stack,
        count: amount,
      }

      return yield* Effect.succeed([remainingStack, splitStack] as const)
    }),

  // ItemStack検証
  validateItemStack: (item) =>
    Effect.gen(function* () {
      const errors: string[] = []

      if (!item.itemId || item.itemId.trim() === '') {
        errors.push('itemId is required')
      }

      if (item.count < 1 || item.count > 64) {
        errors.push('count must be between 1 and 64')
      }

      if (item.durability !== undefined && (item.durability < 0 || item.durability > 1)) {
        errors.push('durability must be between 0 and 1')
      }

      if (errors.length > 0) {
        return yield* Effect.fail(
          new ValidationError({
            reason: 'ItemStack validation failed',
            missingFields: errors,
            context: { item },
          })
        )
      }

      return yield* Effect.void
    }),

  // ItemStack最適化
  optimizeItemStack: (item) =>
    Effect.gen(function* () {
      yield* ItemFactoryLive.validateItemStack(item)

      // メタデータの最適化（空の場合は削除）
      let optimizedMetadata = item.metadata
      if (optimizedMetadata) {
        const hasContent = Object.values(optimizedMetadata).some(
          (value) => value !== undefined && value !== null && (Array.isArray(value) ? value.length > 0 : true)
        )
        if (!hasContent) {
          optimizedMetadata = undefined
        }
      }

      return yield* Effect.succeed({
        ...item,
        metadata: optimizedMetadata,
      })
    }),

  // アイテムクローン
  cloneItem: (item, newCount) =>
    Effect.gen(function* () {
      const clonedItem: ItemStack = {
        ...item,
        count: newCount ?? item.count,
        metadata: item.metadata ? { ...item.metadata } : undefined,
      }

      yield* ItemFactoryLive.validateItemStack(clonedItem)

      return yield* Effect.succeed(clonedItem)
    }),
}

// Layer.effect による依存性注入実装
export const ItemFactoryLayer = Effect.succeed(ItemFactoryLive)
