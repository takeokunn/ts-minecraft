/**
 * ItemManagerService - 高度なアイテム管理サービス
 *
 * アイテムタイプ、レアリティ、属性管理を提供
 * メタデータ、NBTタグ、複雑なアイテム操作に対応
 */

import { Context, Effect, HashMap, Layer, Match, Option, pipe } from 'effect'
import { Schema } from '@effect/schema'
import type { ItemId, ItemStack, ItemMetadata } from './InventoryTypes.js'
import type { ItemDefinition, ItemCategory } from './ItemRegistry.js'
import { ItemRegistry } from './ItemRegistry.js'

// Extended item properties
export const ItemRarity = Schema.Literal('common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic')
export type ItemRarity = Schema.Schema.Type<typeof ItemRarity>

export const ItemQuality = Schema.Number.pipe(
  Schema.between(0, 100),
  Schema.brand('ItemQuality'),
  Schema.annotations({
    title: 'Item Quality',
    description: 'Item quality percentage (0-100)',
  })
)
export type ItemQuality = Schema.Schema.Type<typeof ItemQuality>

// Enhanced item attributes
export const ItemAttributes = Schema.Struct({
  rarity: ItemRarity,
  quality: ItemQuality,
  level: Schema.optional(Schema.Number),
  craftedBy: Schema.optional(Schema.String),
  createdAt: Schema.Number,
  modifiedAt: Schema.Number,
  tags: Schema.Array(Schema.String),
  enchantable: Schema.Boolean,
  repairable: Schema.Boolean,
  tradeable: Schema.Boolean,
  consumable: Schema.Boolean,
})
export type ItemAttributes = Schema.Schema.Type<typeof ItemAttributes>

// Enhanced item definition with attributes
export interface EnhancedItemDefinition extends ItemDefinition {
  readonly attributes: ItemAttributes
  readonly craftingRecipe?: readonly ItemId[]
  readonly repairMaterial?: ItemId
  readonly enchantmentCategories?: readonly string[]
}

// NBT-like data structure for advanced item data
export const ItemNBTData = Schema.Record({ key: Schema.String, value: Schema.Unknown })
export type ItemNBTData = Schema.Schema.Type<typeof ItemNBTData>

// Enhanced item stack with NBT data
export const EnhancedItemStack = Schema.Struct({
  itemId: Schema.String.pipe(Schema.fromBrand(ItemId)),
  count: Schema.Number,
  metadata: Schema.optional(ItemMetadata),
  durability: Schema.optional(Schema.Number),
  attributes: Schema.optional(ItemAttributes),
  nbtData: Schema.optional(ItemNBTData),
  customDisplayName: Schema.optional(Schema.String),
  customLore: Schema.optional(Schema.Array(Schema.String)),
})
export type EnhancedItemStack = Schema.Schema.Type<typeof EnhancedItemStack>

// Item manager errors
export class ItemManagerError extends Error {
  readonly _tag = 'ItemManagerError'
  constructor(
    readonly reason: 'ITEM_NOT_FOUND' | 'INVALID_ITEM_DATA' | 'ENCHANTMENT_FAILED' | 'REPAIR_FAILED' | 'NBT_ERROR',
    readonly details?: unknown
  ) {
    super(`Item manager error: ${reason}`)
  }
}

// Item Manager Service Interface
export interface ItemManagerService {
  // Basic item operations
  readonly createItem: (
    itemId: ItemId,
    count?: number,
    attributes?: Partial<ItemAttributes>
  ) => Effect.Effect<EnhancedItemStack, ItemManagerError>
  readonly cloneItem: (item: EnhancedItemStack, count?: number) => Effect.Effect<EnhancedItemStack, ItemManagerError>
  readonly compareItems: (item1: EnhancedItemStack, item2: EnhancedItemStack) => Effect.Effect<boolean, never>

  // Item attributes management
  readonly getItemAttributes: (itemId: ItemId) => Effect.Effect<Option.Option<ItemAttributes>, ItemManagerError>
  readonly updateItemAttributes: (
    item: EnhancedItemStack,
    attributes: Partial<ItemAttributes>
  ) => Effect.Effect<EnhancedItemStack, ItemManagerError>
  readonly getItemRarity: (itemId: ItemId) => Effect.Effect<ItemRarity, ItemManagerError>
  readonly getItemQuality: (item: EnhancedItemStack) => Effect.Effect<ItemQuality, ItemManagerError>

  // Item metadata and NBT operations
  readonly setItemNBT: (
    item: EnhancedItemStack,
    key: string,
    value: unknown
  ) => Effect.Effect<EnhancedItemStack, ItemManagerError>
  readonly getItemNBT: (item: EnhancedItemStack, key: string) => Effect.Effect<Option.Option<unknown>, never>
  readonly hasItemNBT: (item: EnhancedItemStack, key: string) => Effect.Effect<boolean, never>
  readonly removeItemNBT: (item: EnhancedItemStack, key: string) => Effect.Effect<EnhancedItemStack, never>
  readonly clearItemNBT: (item: EnhancedItemStack) => Effect.Effect<EnhancedItemStack, never>

  // Item naming and display
  readonly setCustomName: (item: EnhancedItemStack, name: string) => Effect.Effect<EnhancedItemStack, never>
  readonly setCustomLore: (
    item: EnhancedItemStack,
    lore: ReadonlyArray<string>
  ) => Effect.Effect<EnhancedItemStack, never>
  readonly getDisplayName: (item: EnhancedItemStack) => Effect.Effect<string, ItemManagerError>
  readonly getDisplayLore: (item: EnhancedItemStack) => Effect.Effect<ReadonlyArray<string>, never>

  // Item durability and repair
  readonly getDurabilityPercentage: (item: EnhancedItemStack) => Effect.Effect<number, never>
  readonly damageItem: (item: EnhancedItemStack, damage: number) => Effect.Effect<EnhancedItemStack, never>
  readonly repairItem: (
    item: EnhancedItemStack,
    repairAmount?: number
  ) => Effect.Effect<EnhancedItemStack, ItemManagerError>
  readonly isItemBroken: (item: EnhancedItemStack) => Effect.Effect<boolean, never>

  // Item categorization and filtering
  readonly getItemsByCategory: (category: ItemCategory) => Effect.Effect<readonly EnhancedItemDefinition[], never>
  readonly getItemsByRarity: (rarity: ItemRarity) => Effect.Effect<readonly EnhancedItemDefinition[], never>
  readonly getItemsByTags: (tags: ReadonlyArray<string>) => Effect.Effect<readonly EnhancedItemDefinition[], never>
  readonly searchItems: (query: string) => Effect.Effect<readonly EnhancedItemDefinition[], never>

  // Item validation and compatibility
  readonly validateItem: (item: EnhancedItemStack) => Effect.Effect<boolean, ItemManagerError>
  readonly canItemsStack: (item1: EnhancedItemStack, item2: EnhancedItemStack) => Effect.Effect<boolean, never>
  readonly canRepairWithItem: (item: EnhancedItemStack, repairItem: EnhancedItemStack) => Effect.Effect<boolean, never>

  // Item statistics and analysis
  readonly getItemStatistics: (itemId: ItemId) => Effect.Effect<
    {
      totalCount: number
      averageQuality: number
      mostCommonRarity: ItemRarity
      usageFrequency: number
    },
    never
  >
}

// Context tag
export const ItemManagerService = Context.GenericTag<ItemManagerService>('@minecraft/ItemManagerService')

// Default item attributes
const createDefaultAttributes = (): ItemAttributes => ({
  rarity: 'common',
  quality: Schema.decodeSync(ItemQuality)(100),
  createdAt: Date.now(),
  modifiedAt: Date.now(),
  tags: [],
  enchantable: true,
  repairable: true,
  tradeable: true,
  consumable: false,
})

// Enhanced item registry with attributes
let enhancedItemRegistry: HashMap.HashMap<ItemId, EnhancedItemDefinition> = HashMap.empty()

// Item Manager Service Implementation
export const ItemManagerServiceLive = Layer.effect(
  ItemManagerService,
  Effect.gen(function* () {
    const itemRegistry = yield* ItemRegistry

    return ItemManagerService.of({
      createItem: (itemId: ItemId, count = 1, attributes?: Partial<ItemAttributes>) =>
        Effect.gen(function* () {
          const definition = yield* itemRegistry.getItem(itemId)

          return yield* pipe(
            definition,
            Option.match({
              onNone: () => Effect.fail(new ItemManagerError('ITEM_NOT_FOUND', { itemId })),
              onSome: (def) =>
                Effect.succeed({
                  itemId,
                  count: Math.min(count, def.maxStackSize),
                  attributes: { ...createDefaultAttributes(), ...attributes },
                  nbtData: {},
                } satisfies EnhancedItemStack),
            })
          )
        }),

      cloneItem: (item: EnhancedItemStack, count?: number) =>
        Effect.succeed({
          ...item,
          count: count ?? item.count,
          attributes: item.attributes
            ? {
                ...item.attributes,
                modifiedAt: Date.now(),
              }
            : undefined,
        }),

      compareItems: (item1: EnhancedItemStack, item2: EnhancedItemStack) =>
        Effect.succeed(
          item1.itemId === item2.itemId &&
            JSON.stringify(item1.metadata) === JSON.stringify(item2.metadata) &&
            JSON.stringify(item1.nbtData) === JSON.stringify(item2.nbtData)
        ),

      getItemAttributes: (itemId: ItemId) =>
        Effect.sync(() => {
          const definition = HashMap.get(enhancedItemRegistry, itemId)
          return Option.map(definition, (def) => def.attributes)
        }),

      updateItemAttributes: (item: EnhancedItemStack, attributes: Partial<ItemAttributes>) =>
        Effect.succeed({
          ...item,
          attributes: item.attributes
            ? {
                ...item.attributes,
                ...attributes,
                modifiedAt: Date.now(),
              }
            : { ...createDefaultAttributes(), ...attributes },
        }),

      getItemRarity: (itemId: ItemId) =>
        Effect.gen(function* () {
          const definition = HashMap.get(enhancedItemRegistry, itemId)
          return yield* pipe(
            definition,
            Option.match({
              onNone: () => Effect.succeed('common' as ItemRarity),
              onSome: (def) => Effect.succeed(def.attributes.rarity),
            })
          )
        }),

      getItemQuality: (item: EnhancedItemStack) =>
        Effect.succeed(item.attributes?.quality ?? Schema.decodeSync(ItemQuality)(100)),

      setItemNBT: (item: EnhancedItemStack, key: string, value: unknown) =>
        Effect.succeed({
          ...item,
          nbtData: {
            ...item.nbtData,
            [key]: value,
          },
        }),

      getItemNBT: (item: EnhancedItemStack, key: string) =>
        Effect.succeed(
          pipe(
            Option.fromNullable(item.nbtData?.[key]),
            Option.filter((value) => value !== undefined)
          )
        ),

      hasItemNBT: (item: EnhancedItemStack, key: string) => Effect.succeed(!!(item.nbtData && key in item.nbtData)),

      removeItemNBT: (item: EnhancedItemStack, key: string) =>
        Effect.sync(() => {
          const newNbtData = { ...item.nbtData }
          delete newNbtData[key]
          return {
            ...item,
            nbtData: newNbtData,
          }
        }),

      clearItemNBT: (item: EnhancedItemStack) =>
        Effect.succeed({
          ...item,
          nbtData: {},
        }),

      setCustomName: (item: EnhancedItemStack, name: string) =>
        Effect.succeed({
          ...item,
          customDisplayName: name,
        }),

      setCustomLore: (item: EnhancedItemStack, lore: ReadonlyArray<string>) =>
        Effect.succeed({
          ...item,
          customLore: [...lore],
        }),

      getDisplayName: (item: EnhancedItemStack) =>
        Effect.gen(function* () {
          return yield* pipe(
            Option.fromNullable(item.customDisplayName),
            Option.match({
              onSome: (name) => Effect.succeed(name),
              onNone: () =>
                Effect.gen(function* () {
                  const definition = yield* itemRegistry.getItem(item.itemId)
                  return yield* pipe(
                    definition,
                    Option.match({
                      onNone: () => Effect.fail(new ItemManagerError('ITEM_NOT_FOUND', { itemId: item.itemId })),
                      onSome: (def) => Effect.succeed(def.name),
                    })
                  )
                }),
            })
          )
        }),

      getDisplayLore: (item: EnhancedItemStack) => Effect.succeed(item.customLore ?? []),

      getDurabilityPercentage: (item: EnhancedItemStack) =>
        Effect.sync(() => {
          const currentDurability = item.durability ?? 1
          const maxDurability = 1 // Would come from item definition
          return (currentDurability / maxDurability) * 100
        }),

      damageItem: (item: EnhancedItemStack, damage: number) =>
        Effect.succeed({
          ...item,
          durability: Math.max(0, (item.durability ?? 1) - damage / 1000),
        }),

      repairItem: (item: EnhancedItemStack, repairAmount?: number) =>
        Effect.gen(function* () {
          const definition = yield* itemRegistry.getItem(item.itemId)

          return yield* pipe(
            definition,
            Option.match({
              onNone: () => Effect.fail(new ItemManagerError('ITEM_NOT_FOUND', { itemId: item.itemId })),
              onSome: (def) => {
                const currentDurability = item.durability ?? 1
                const maxDurability = 1 // Would come from item definition
                const repair = repairAmount ?? maxDurability * 0.25 // Repair 25% by default
                const newDurability = Math.min(maxDurability, currentDurability + repair)

                return Effect.succeed({
                  ...item,
                  durability: newDurability,
                })
              },
            })
          )
        }),

      isItemBroken: (item: EnhancedItemStack) => Effect.succeed((item.durability ?? 1) <= 0),

      getItemsByCategory: (category: ItemCategory) =>
        Effect.gen(function* () {
          const allItems = yield* itemRegistry.getItemsByCategory(category)
          return allItems.map((item) => {
            const enhanced = HashMap.get(enhancedItemRegistry, item.id)
            return Option.match(enhanced, {
              onNone: () => ({ ...item, attributes: createDefaultAttributes() }),
              onSome: (enhancedItem) => enhancedItem,
            })
          })
        }),

      getItemsByRarity: (rarity: ItemRarity) =>
        Effect.sync(() =>
          Array.from(HashMap.values(enhancedItemRegistry)).filter((item) => item.attributes.rarity === rarity)
        ),

      getItemsByTags: (tags: ReadonlyArray<string>) =>
        Effect.sync(() =>
          Array.from(HashMap.values(enhancedItemRegistry)).filter((item) =>
            tags.some((tag: string) => item.attributes.tags.includes(tag))
          )
        ),

      searchItems: (query: string) =>
        Effect.sync(() => {
          const lowercaseQuery = query.toLowerCase()
          return Array.from(HashMap.values(enhancedItemRegistry)).filter(
            (item) =>
              item.name.toLowerCase().includes(lowercaseQuery) ||
              item.attributes.tags.some((tag) => tag.toLowerCase().includes(lowercaseQuery))
          )
        }),

      validateItem: (item: EnhancedItemStack) =>
        Effect.gen(function* () {
          const definition = yield* itemRegistry.getItem(item.itemId)

          return yield* pipe(
            definition,
            Option.match({
              onNone: () => Effect.fail(new ItemManagerError('ITEM_NOT_FOUND', { itemId: item.itemId })),
              onSome: (def) =>
                Effect.gen(function* () {
                  const isValidCount = item.count > 0 && item.count <= def.maxStackSize
                  const isValidDurability = !item.durability || (item.durability >= 0 && item.durability <= 1)

                  return isValidCount && isValidDurability
                }),
            })
          )
        }),

      canItemsStack: (item1: EnhancedItemStack, item2: EnhancedItemStack) =>
        Effect.gen(function* () {
          const basicStackable = yield* itemRegistry.canStack(item1, item2)

          return yield* pipe(
            Match.value(basicStackable),
            Match.when(false, () => Effect.succeed(false)),
            Match.when(true, () =>
              Effect.succeed(
                JSON.stringify(item1.nbtData) === JSON.stringify(item2.nbtData) &&
                  item1.customDisplayName === item2.customDisplayName &&
                  JSON.stringify(item1.customLore) === JSON.stringify(item2.customLore)
              )
            ),
            Match.exhaustive
          )
        }),

      canRepairWithItem: (item: EnhancedItemStack, repairItem: EnhancedItemStack) =>
        Effect.gen(function* () {
          const definition = yield* itemRegistry.getItem(item.itemId)

          return yield* pipe(
            definition,
            Option.match({
              onNone: () => Effect.succeed(false),
              onSome: (def) => {
                // Check if repair item matches the item's repair material
                const enhanced = HashMap.get(enhancedItemRegistry, item.itemId)
                return pipe(
                  enhanced,
                  Option.match({
                    onNone: () => Effect.succeed(false),
                    onSome: (enhancedDef) =>
                      Effect.succeed(!!enhancedDef.repairMaterial && enhancedDef.repairMaterial === repairItem.itemId),
                  })
                )
              },
            })
          )
        }),

      getItemStatistics: (itemId: ItemId) =>
        Effect.succeed({
          totalCount: 0,
          averageQuality: 100,
          mostCommonRarity: 'common' as ItemRarity,
          usageFrequency: 0,
        }),
    })
  })
)

// Helper to register enhanced item definitions
export const registerEnhancedItem = (definition: EnhancedItemDefinition): Effect.Effect<void, never> =>
  Effect.sync(() => {
    enhancedItemRegistry = HashMap.set(enhancedItemRegistry, definition.id, definition)
  })

// Helper to create common item attributes
export const ItemAttributesFactory = {
  common: (): ItemAttributes => ({ ...createDefaultAttributes(), rarity: 'common' }),
  uncommon: (): ItemAttributes => ({ ...createDefaultAttributes(), rarity: 'uncommon' }),
  rare: (): ItemAttributes => ({ ...createDefaultAttributes(), rarity: 'rare' }),
  epic: (): ItemAttributes => ({ ...createDefaultAttributes(), rarity: 'epic' }),
  legendary: (): ItemAttributes => ({ ...createDefaultAttributes(), rarity: 'legendary' }),
  mythic: (): ItemAttributes => ({ ...createDefaultAttributes(), rarity: 'mythic' }),

  withQuality: (quality: number): ItemAttributes => ({
    ...createDefaultAttributes(),
    quality: Schema.decodeSync(ItemQuality)(Math.max(0, Math.min(100, quality))),
  }),

  withTags: (tags: string[]): ItemAttributes => ({
    ...createDefaultAttributes(),
    tags: [...tags],
  }),

  craftedItem: (craftedBy: string): ItemAttributes => ({
    ...createDefaultAttributes(),
    craftedBy,
    tags: ['crafted'],
  }),
}
