/**
 * ItemFactory - DDD Factory Implementation for ItemStack
 *
 * Effect-TSの関数型パターンによるItemStack生成の純粋関数実装
 * class構文を一切使用せず、pipe/flowによる関数合成とEffect.genで実装
 */

import { Effect, Layer, Match, Option, pipe, ReadonlyArray, Schema } from 'effect'
import type { ItemMetadata, ItemStack } from '../../types'
import { ItemQualitySchema } from '../../types/item_enums'
import {
  ItemCreationError as CreationError,
  defaultItemConfig,
  defaultStackingRules,
  EnchantmentDefinition,
  ItemCategory,
  ItemConfig,
  ItemCreationError,
  ItemFactory,
  ItemStackError,
  ItemStackError as StackError,
  StackingRules,
  ItemValidationError as ValidationError,
} from './interface'

// ===== 内部ヘルパー関数（Pure Functions） =====

const collectSome = <A>(inputs: ReadonlyArray<Option.Option<A>>): ReadonlyArray<A> =>
  pipe(
    inputs,
    ReadonlyArray.filterMap((option) => option)
  )

const filterMapArray = <A, B>(
  items: ReadonlyArray<A>,
  project: (value: A, index: number) => Option.Option<B>
): ReadonlyArray<B> => pipe(items, ReadonlyArray.filterMap(project))

const getNonEmptyOrUndefined = <K extends PropertyKey, V>(
  entries: ReadonlyArray<readonly [K, V]>
): Record<K, V> | undefined => {
  if (entries.length === 0) {
    return undefined
  }
  return Object.fromEntries(entries) as Record<K, V>
}

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
      quality: Schema.make(ItemQualitySchema)('common'),
    })),
    Match.when('weapon', () => ({
      stackable: false,
      maxStackSize: 1,
      durability: 1.0,
      maxDurability: 150,
      quality: Schema.make(ItemQualitySchema)('common'),
    })),
    Match.when('armor', () => ({
      stackable: false,
      maxStackSize: 1,
      durability: 1.0,
      maxDurability: 200,
      quality: Schema.make(ItemQualitySchema)('common'),
    })),
    Match.when('food', () => ({
      stackable: true,
      maxStackSize: 16,
      durability: undefined,
      quality: Schema.make(ItemQualitySchema)('common'),
    })),
    Match.when('block', () => ({
      stackable: true,
      maxStackSize: 64,
      durability: undefined,
      quality: Schema.make(ItemQualitySchema)('common'),
    })),
    Match.when('resource', () => ({
      stackable: true,
      maxStackSize: 64,
      durability: undefined,
      quality: Schema.make(ItemQualitySchema)('common'),
    })),
    Match.when('consumable', () => ({
      stackable: true,
      maxStackSize: 8,
      durability: undefined,
      quality: Schema.make(ItemQualitySchema)('common'),
    })),
    Match.when('redstone', () => ({
      stackable: true,
      maxStackSize: 64,
      durability: undefined,
      quality: Schema.make(ItemQualitySchema)('common'),
    })),
    Match.when('decoration', () => ({
      stackable: true,
      maxStackSize: 64,
      durability: undefined,
      quality: Schema.make(ItemQualitySchema)('common'),
    })),
    Match.when('misc', () => ({
      stackable: true,
      maxStackSize: 64,
      durability: undefined,
      quality: Schema.make(ItemQualitySchema)('common'),
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
const whenInvalid = (condition: boolean, message: string): Option.Option<string> =>
  condition ? Option.some(message) : Option.none()

const validateItemConfig = (config: ItemConfig): Effect.Effect<void, ItemCreationError> => {
  const baseErrors = collectSome([
    whenInvalid(!(typeof config.itemId === 'string' && config.itemId.trim().length > 0), 'itemId is required'),
    pipe(
      Option.fromNullable(config.count),
      Option.flatMap((value) => whenInvalid(value < 1 || value > 64, 'count must be between 1 and 64'))
    ),
    pipe(
      Option.fromNullable(config.durability),
      Option.flatMap((value) => whenInvalid(value < 0 || value > 1, 'durability must be between 0 and 1'))
    ),
    pipe(
      Option.fromNullable(config.maxStackSize),
      Option.flatMap((value) => whenInvalid(value < 1 || value > 64, 'maxStackSize must be between 1 and 64'))
    ),
  ])

  const enchantmentErrors: ReadonlyArray<string> = pipe(
    Option.fromNullable(config.enchantments),
    Option.match({
      onNone: () => [],
      onSome: (enchantments) =>
        filterMapArray(enchantments, (enchant) =>
          whenInvalid(
            enchant.level < 1 || enchant.level > enchant.maxLevel,
            `enchantment ${enchant.id} level ${enchant.level} exceeds max level ${enchant.maxLevel}`
          )
        ),
    })
  )

  const errors = [...baseErrors, ...enchantmentErrors]

  return pipe(
    errors.length === 0,
    Match.value,
    Match.when(true, () => Effect.void),
    Match.orElse(() =>
      Effect.fail(
        new CreationError({
          reason: 'Invalid item configuration',
          invalidFields: [...errors],
          context: { config },
        })
      )
    )
  )
}

// ItemMetadata生成（Pure Function）
const createItemMetadata = (config: ItemConfig): ItemMetadata | undefined => {
  const baseEntries = collectSome([
    pipe(
      Option.fromNullable(config.enchantments),
      Option.filter((items) => items.length > 0),
      Option.map(
        (items) => ['enchantments', items.map((enchant) => ({ id: enchant.id, level: enchant.level }))] as const
      )
    ),
    pipe(
      Option.fromNullable(config.customName),
      Option.map((value) => ['customName', value] as const)
    ),
    pipe(
      Option.fromNullable(config.lore),
      Option.filter((lore) => lore.length > 0),
      Option.map((value) => ['lore', [...value]] as const)
    ),
    pipe(
      Option.fromNullable(config.nbtData),
      Option.filter((data) => Object.keys(data).length > 0),
      Option.map((value) => ['nbtData', value] as const)
    ),
  ])

  const durabilityEntries = pipe(
    Option.fromNullable(config.maxDurability),
    Option.flatMap((maxDurability) =>
      pipe(
        Option.fromNullable(config.durability),
        Option.filter((ratio) => ratio !== 1.0),
        Option.map(
          (ratio) =>
            [
              ['damage', Math.floor((1 - ratio) * maxDurability)] as const,
              ['durability', maxDurability] as const,
            ] satisfies ReadonlyArray<readonly [string, unknown]>
        )
      )
    ),
    Option.getOrElse(() => [] as ReadonlyArray<readonly [string, unknown]>)
  )

  const allEntries = [...baseEntries, ...durabilityEntries]

  return getNonEmptyOrUndefined(allEntries) as ItemMetadata | undefined
}

const normalizeMetadata = (metadata?: ItemMetadata): ItemMetadata | undefined =>
  pipe(
    Option.fromNullable(metadata),
    Option.filter((meta) => Object.values(meta).some((value) => value !== undefined)),
    Option.getOrUndefined
  )

// エンチャント競合チェック（Pure Function）
const checkEnchantmentConflicts = (
  enchantments: ReadonlyArray<EnchantmentDefinition>
): Effect.Effect<void, ItemCreationError> => {
  const conflicts = enchantments.flatMap((outer, index) =>
    pipe(
      Option.fromNullable(outer.conflictsWith),
      Option.match({
        onNone: () => [] as string[],
        onSome: (conflictsWith) =>
          enchantments
            .slice(index + 1)
            .filter((inner) => conflictsWith.includes(inner.id))
            .map((inner) => `${outer.id} conflicts with ${inner.id}`),
      })
    )
  )

  return pipe(
    conflicts.length === 0,
    Match.value,
    Match.when(true, () => Effect.void),
    Match.orElse(() =>
      Effect.fail(
        new CreationError({
          reason: 'Enchantment conflicts detected',
          invalidFields: [...conflicts],
          context: { enchantments },
        })
      )
    )
  )
}

const ensureNoEnchantmentConflicts = (config: ItemConfig): Effect.Effect<ItemConfig, ItemCreationError> =>
  pipe(
    Option.fromNullable(config.enchantments),
    Option.filter((items) => items.length > 0),
    Option.match({
      onNone: () => Effect.succeed(config),
      onSome: (enchantments) => checkEnchantmentConflicts(enchantments).pipe(Effect.as(config)),
    })
  )

// スタック結合の検証（Pure Function with Effect）
const validateStackCombination = (
  stack1: ItemStack,
  stack2: ItemStack,
  rules: StackingRules = defaultStackingRules
): Effect.Effect<void, ItemStackError> =>
  pipe(
    Effect.succeed({ stack1, stack2, rules }),
    Effect.filterOrFail(
      ({ stack1, stack2, rules }) => rules.canStack(stack1, stack2),
      ({ stack1, stack2 }) =>
        new StackError({
          reason: 'Items cannot be stacked together',
          stackingRules: { rule: 'canStack', result: false },
          context: { stack1, stack2 },
        })
    ),
    Effect.flatMap(({ stack1, stack2, rules }) =>
      pipe(
        Effect.succeed({
          stack1,
          stack2,
          maxSize: rules.maxStackSize(stack1),
          combinedCount: stack1.count + stack2.count,
        }),
        Effect.filterOrFail(
          ({ combinedCount, maxSize }) => combinedCount <= maxSize,
          ({ stack1, stack2, maxSize, combinedCount }) =>
            new StackError({
              reason: 'Combined count exceeds maximum stack size',
              stackingRules: { maxStackSize: maxSize, attempted: combinedCount },
              context: { stack1, stack2 },
            })
        ),
        Effect.asVoid
      )
    )
  )

// ===== Factory実装（Function.flowとEffect.genパターン） =====

export const ItemFactoryLive: ItemFactory = {
  createBasic: (itemId, count = 1) =>
    ItemFactoryLive.createWithConfig({
      ...defaultItemConfig,
      itemId,
      count,
    }),

  createWithConfig: (config) =>
    pipe(
      Effect.succeed(config),
      Effect.tap(validateItemConfig),
      Effect.map((input) => ({
        ...defaultItemConfig,
        ...(input.category ? getCategoryDefaults(input.category) : {}),
        ...input,
      })),
      Effect.map(applyRarityModifiers),
      Effect.flatMap(ensureNoEnchantmentConflicts),
      Effect.flatMap((normalized) =>
        pipe(
          Option.fromNullable(normalized.itemId),
          Option.match({
            onNone: () =>
              Effect.fail(
                new CreationError({
                  reason: 'Invalid item configuration',
                  invalidFields: ['itemId is required'],
                  context: { config: normalized },
                })
              ),
            onSome: (itemId) => Effect.succeed({ normalized, itemId }),
          })
        )
      ),
      Effect.map(({ normalized, itemId }) => ({
        itemId,
        count: normalized.count ?? 1,
        metadata: createItemMetadata(normalized),
        durability: normalized.durability,
      }))
    ),

  createTool: (itemId, durability = 1.0, enchantments = []) =>
    ItemFactoryLive.createWithConfig({
      itemId,
      category: 'tool',
      durability,
      enchantments,
      count: 1,
    }),

  createWeapon: (itemId, durability = 1.0, enchantments = []) =>
    ItemFactoryLive.createWithConfig({
      itemId,
      category: 'weapon',
      durability,
      enchantments,
      count: 1,
    }),

  createArmor: (itemId, durability = 1.0, enchantments = []) =>
    ItemFactoryLive.createWithConfig({
      itemId,
      category: 'armor',
      durability,
      enchantments,
      count: 1,
    }),

  createFood: (itemId, count = 1, customEffects = {}) =>
    ItemFactoryLive.createWithConfig({
      itemId,
      category: 'food',
      count,
      nbtData: pipe(
        Option.fromPredicate((record: Record<string, unknown>) => Object.keys(record).length > 0)(customEffects),
        Option.getOrUndefined
      ),
    }),

  createBlock: (itemId, count = 1) =>
    ItemFactoryLive.createWithConfig({
      itemId,
      category: 'block',
      count,
    }),

  addEnchantment: (item, enchantment) =>
    pipe(
      [
        enchantment,
        ...((item.metadata?.enchantments ?? []).map((existing) => ({
          ...enchantment,
          id: existing.id,
          level: existing.level,
        })) as ReadonlyArray<EnchantmentDefinition>),
      ],
      checkEnchantmentConflicts,
      Effect.map(() => {
        const existingEnchantments = item.metadata?.enchantments ?? []
        const filtered = existingEnchantments.filter((entry) => entry.id !== enchantment.id)
        const nextEnchantments = [...filtered, { id: enchantment.id, level: enchantment.level }]

        const updatedMetadata: ItemMetadata = {
          ...item.metadata,
          enchantments: nextEnchantments,
        }

        return {
          ...item,
          metadata: updatedMetadata,
        }
      })
    ),

  removeEnchantment: (item, enchantmentId) =>
    pipe(
      Option.fromNullable(item.metadata?.enchantments),
      Option.match({
        onNone: () => Effect.succeed(item),
        onSome: (enchantments) =>
          pipe(
            enchantments,
            (entries) => entries.filter((entry) => entry.id !== enchantmentId),
            (remaining) =>
              pipe(
                Option.fromNullable(item.metadata),
                Option.map((metadata) => ({
                  ...metadata,
                  enchantments: remaining.length === 0 ? undefined : remaining,
                })),
                Option.match({
                  onNone: () => Effect.succeed(item),
                  onSome: (metadata) =>
                    Effect.succeed({
                      ...item,
                      metadata: normalizeMetadata(metadata),
                    }),
                })
              )
          ),
      })
    ),

  combineStacks: (stack1, stack2) =>
    validateStackCombination(stack1, stack2).pipe(
      Effect.as({
        ...stack1,
        count: stack1.count + stack2.count,
      })
    ),

  splitStack: (stack, amount) =>
    pipe(
      Effect.succeed({ stack, amount }),
      Effect.filterOrFail(
        ({ stack, amount }) => amount > 0 && amount < stack.count,
        ({ stack, amount }) =>
          new StackError({
            reason: 'Invalid split amount',
            stackingRules: { originalCount: stack.count, splitAmount: amount },
            context: { stack },
          })
      ),
      Effect.map(
        ({ stack, amount }) =>
          [
            { ...stack, count: stack.count - amount },
            { ...stack, count: amount },
          ] as const
      )
    ),

  validateItemStack: (item) =>
    pipe(
      collectSome([
        whenInvalid(!(typeof item.itemId === 'string' && item.itemId.trim().length > 0), 'itemId is required'),
        whenInvalid(item.count < 1 || item.count > 64, 'count must be between 1 and 64'),
        pipe(
          Option.fromNullable(item.durability),
          Option.flatMap((value) => whenInvalid(value < 0 || value > 1, 'durability must be between 0 and 1'))
        ),
      ]),
      (errors) =>
        errors.length === 0
          ? Effect.void
          : Effect.fail(
              new ValidationError({
                reason: 'ItemStack validation failed',
                missingFields: [...errors],
                context: { item },
              })
            )
    ),

  optimizeItemStack: (item) =>
    ItemFactoryLive.validateItemStack(item).pipe(
      Effect.map(() => ({
        ...item,
        metadata: normalizeMetadata(item.metadata),
      }))
    ),

  cloneItem: (item, newCount) => {
    const clonedItem: ItemStack = {
      ...item,
      count: newCount ?? item.count,
      metadata: item.metadata ? { ...item.metadata } : undefined,
    }

    return ItemFactoryLive.validateItemStack(clonedItem).pipe(Effect.as(clonedItem))
  },
}

// Layer による依存性注入実装
export const ItemFactoryLayer = Layer.succeed(ItemFactory, ItemFactoryLive)
