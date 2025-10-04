import { Context, Effect, Layer, Option, pipe } from 'effect'
import type { ItemId, ItemStack } from './InventoryTypes'
import { ItemId as makeItemId } from './InventoryTypes'

export type ItemCategory =
  | 'block'
  | 'tool'
  | 'weapon'
  | 'armor'
  | 'utility'
  | 'consumable'

export interface ItemDefinition {
  readonly id: ItemId
  readonly displayName: string
  readonly category: ItemCategory
  readonly maxStackSize: number
  readonly stackable: boolean
  readonly tags: ReadonlyArray<string>
}

export interface ItemRegistryService {
  readonly getDefinition: (itemId: ItemId) => Effect.Effect<Option.Option<ItemDefinition>>
  readonly ensureDefinition: (itemId: ItemId) => Effect.Effect<ItemDefinition, ItemRegistryError>
  readonly getDefinitionsByCategory: (
    category: ItemCategory
  ) => Effect.Effect<ReadonlyArray<ItemDefinition>>
  readonly canStack: (left: ItemStack, right: ItemStack) => Effect.Effect<boolean>
  readonly listAll: () => Effect.Effect<ReadonlyArray<ItemDefinition>>
}

export type ItemRegistryError = { readonly _tag: 'ItemNotFound'; readonly itemId: ItemId }

export const ItemRegistryError = {
  itemNotFound: (itemId: ItemId): ItemRegistryError => ({ _tag: 'ItemNotFound', itemId }),
} as const

const createDefinition = (definition: Omit<ItemDefinition, 'id'> & { readonly id: string }): ItemDefinition => ({
  ...definition,
  id: makeItemId(definition.id),
})

const definitions: ReadonlyArray<ItemDefinition> = [
  createDefinition({
    id: 'minecraft:dirt',
    displayName: 'Dirt',
    category: 'block',
    maxStackSize: 64,
    stackable: true,
    tags: ['ground', 'basic'],
  }),
  createDefinition({
    id: 'minecraft:stone',
    displayName: 'Stone',
    category: 'block',
    maxStackSize: 64,
    stackable: true,
    tags: ['rock'],
  }),
  createDefinition({
    id: 'minecraft:grass_block',
    displayName: 'Grass Block',
    category: 'block',
    maxStackSize: 64,
    stackable: true,
    tags: ['nature'],
  }),
  createDefinition({
    id: 'minecraft:iron_sword',
    displayName: 'Iron Sword',
    category: 'weapon',
    maxStackSize: 1,
    stackable: false,
    tags: ['sword', 'combat'],
  }),
  createDefinition({
    id: 'minecraft:iron_helmet',
    displayName: 'Iron Helmet',
    category: 'armor',
    maxStackSize: 1,
    stackable: false,
    tags: ['armor', 'helmet'],
  }),
  createDefinition({
    id: 'minecraft:diamond_helmet',
    displayName: 'Diamond Helmet',
    category: 'armor',
    maxStackSize: 1,
    stackable: false,
    tags: ['armor', 'helmet'],
  }),
  createDefinition({
    id: 'minecraft:shield',
    displayName: 'Shield',
    category: 'utility',
    maxStackSize: 1,
    stackable: false,
    tags: ['defense'],
  }),
]

const definitionMap = new Map(definitions.map((definition) => [definition.id, definition] as const))

const sameMetadata = (left: ItemStack, right: ItemStack) =>
  JSON.stringify(left.metadata ?? null) === JSON.stringify(right.metadata ?? null)

const createService = (): ItemRegistryService => ({
  getDefinition: (itemId) => Effect.sync(() => Option.fromNullable(definitionMap.get(itemId))),

  ensureDefinition: (itemId) =>
    pipe(
      Option.fromNullable(definitionMap.get(itemId)),
      Option.match({
        onSome: Effect.succeed,
        onNone: () => Effect.fail(ItemRegistryError.itemNotFound(itemId)),
      })
    ),

  getDefinitionsByCategory: (category) =>
    Effect.sync(() => definitions.filter((definition) => definition.category === category)),

  listAll: () => Effect.sync(() => definitions),

  canStack: (left, right) =>
    Effect.gen(function* () {
      const definition = yield* pipe(
        Option.fromNullable(definitionMap.get(left.itemId)),
        Option.match({
          onSome: Effect.succeed,
          onNone: () => Effect.fail(ItemRegistryError.itemNotFound(left.itemId)),
        })
      )

      return definition.stackable && left.itemId === right.itemId && sameMetadata(left, right)
    }),
})

const ItemRegistryTag = Context.GenericTag<ItemRegistryService>(
  '@minecraft/domain/inventory/ItemRegistry'
)

export const ItemRegistryLive = Layer.effect(ItemRegistryTag, Effect.sync(createService))

export const ItemRegistry = Object.assign(ItemRegistryTag, {
  Live: ItemRegistryLive,
  Default: ItemRegistryLive,
})

export type ItemRegistry = ItemRegistryService
