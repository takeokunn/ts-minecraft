/**
 * ItemRegistry - Central item definition and management
 *
 * Manages item definitions, stack sizes, and item properties
 * Integrates with block system for block items
 */

import { Context, Effect, HashMap, Layer, Option, pipe } from 'effect'
import { ItemId, ItemStack } from './InventoryTypes.js'

// Item category types
export type ItemCategory = 'block' | 'tool' | 'weapon' | 'armor' | 'food' | 'material' | 'special'

// Item definition
export interface ItemDefinition {
  readonly id: ItemId
  readonly name: string
  readonly category: ItemCategory
  readonly maxStackSize: number
  readonly isStackable: boolean
  readonly durability?: number
  readonly toolType?: 'pickaxe' | 'axe' | 'shovel' | 'hoe' | 'sword'
  readonly armorType?: 'helmet' | 'chestplate' | 'leggings' | 'boots'
  readonly armorValue?: number
  readonly damage?: number
  readonly miningSpeed?: number
  readonly foodValue?: number
  readonly saturation?: number
}

// Registry state
interface RegistryState {
  readonly items: HashMap.HashMap<ItemId, ItemDefinition>
}

// Item Registry Service
export class ItemRegistry extends Context.Tag('ItemRegistry')<
  ItemRegistry,
  {
    readonly getItem: (itemId: ItemId) => Effect.Effect<Option.Option<ItemDefinition>>
    readonly registerItem: (definition: ItemDefinition) => Effect.Effect<void>
    readonly getAllItems: () => Effect.Effect<ItemDefinition[]>
    readonly canStack: (item1: ItemStack, item2: ItemStack) => Effect.Effect<boolean>
    readonly getMaxStackSize: (itemId: ItemId) => Effect.Effect<number>
    readonly isValidItem: (itemId: ItemId) => Effect.Effect<boolean>
    readonly getItemsByCategory: (category: ItemCategory) => Effect.Effect<ItemDefinition[]>
  }
>() {
  static readonly Default = Layer.succeed(ItemRegistry, {
    getItem: (itemId: ItemId) =>
      Effect.sync(() => {
        const state = getState()
        return HashMap.get(state.items, itemId)
      }),

    registerItem: (definition: ItemDefinition) =>
      Effect.sync(() => {
        setState({
          items: HashMap.set(getState().items, definition.id, definition),
        })
      }),

    getAllItems: () =>
      Effect.sync(() => {
        const state = getState()
        return Array.from(HashMap.values(state.items))
      }),

    canStack: (item1: ItemStack, item2: ItemStack) =>
      Effect.gen(function* () {
        if (item1.itemId !== item2.itemId) return false

        const state = getState()
        const definition = HashMap.get(state.items, item1.itemId)

        if (Option.isNone(definition)) return false
        if (!definition.value.isStackable) return false

        // Check metadata compatibility
        const meta1 = item1.metadata
        const meta2 = item2.metadata

        if (meta1 || meta2) {
          // Items with different metadata cannot stack
          return JSON.stringify(meta1) === JSON.stringify(meta2)
        }

        return true
      }),

    getMaxStackSize: (itemId: ItemId) =>
      Effect.sync(() => {
        const state = getState()
        const definition = HashMap.get(state.items, itemId)
        return Option.isSome(definition) ? definition.value.maxStackSize : 64
      }),

    isValidItem: (itemId: ItemId) =>
      Effect.sync(() => {
        const state = getState()
        return HashMap.has(state.items, itemId)
      }),

    getItemsByCategory: (category: ItemCategory) =>
      Effect.sync(() => {
        const state = getState()
        return Array.from(HashMap.values(state.items)).filter((item) => item.category === category)
      }),
  })
}

// State management (module scope for simplicity)
let registryState: RegistryState = {
  items: HashMap.fromIterable([
    // Block items
    [
      ItemId('minecraft:dirt'),
      {
        id: ItemId('minecraft:dirt'),
        name: 'Dirt',
        category: 'block',
        maxStackSize: 64,
        isStackable: true,
      },
    ],
    [
      ItemId('minecraft:stone'),
      {
        id: ItemId('minecraft:stone'),
        name: 'Stone',
        category: 'block',
        maxStackSize: 64,
        isStackable: true,
      },
    ],
    [
      ItemId('minecraft:grass_block'),
      {
        id: ItemId('minecraft:grass_block'),
        name: 'Grass Block',
        category: 'block',
        maxStackSize: 64,
        isStackable: true,
      },
    ],
    [
      ItemId('minecraft:oak_log'),
      {
        id: ItemId('minecraft:oak_log'),
        name: 'Oak Log',
        category: 'block',
        maxStackSize: 64,
        isStackable: true,
      },
    ],
    [
      ItemId('minecraft:oak_planks'),
      {
        id: ItemId('minecraft:oak_planks'),
        name: 'Oak Planks',
        category: 'block',
        maxStackSize: 64,
        isStackable: true,
      },
    ],

    // Tools
    [
      ItemId('minecraft:wooden_pickaxe'),
      {
        id: ItemId('minecraft:wooden_pickaxe'),
        name: 'Wooden Pickaxe',
        category: 'tool',
        maxStackSize: 1,
        isStackable: false,
        durability: 59,
        toolType: 'pickaxe',
        miningSpeed: 2,
      },
    ],
    [
      ItemId('minecraft:stone_pickaxe'),
      {
        id: ItemId('minecraft:stone_pickaxe'),
        name: 'Stone Pickaxe',
        category: 'tool',
        maxStackSize: 1,
        isStackable: false,
        durability: 131,
        toolType: 'pickaxe',
        miningSpeed: 4,
      },
    ],
    [
      ItemId('minecraft:iron_pickaxe'),
      {
        id: ItemId('minecraft:iron_pickaxe'),
        name: 'Iron Pickaxe',
        category: 'tool',
        maxStackSize: 1,
        isStackable: false,
        durability: 250,
        toolType: 'pickaxe',
        miningSpeed: 6,
      },
    ],
    [
      ItemId('minecraft:diamond_pickaxe'),
      {
        id: ItemId('minecraft:diamond_pickaxe'),
        name: 'Diamond Pickaxe',
        category: 'tool',
        maxStackSize: 1,
        isStackable: false,
        durability: 1561,
        toolType: 'pickaxe',
        miningSpeed: 8,
      },
    ],

    // Weapons
    [
      ItemId('minecraft:wooden_sword'),
      {
        id: ItemId('minecraft:wooden_sword'),
        name: 'Wooden Sword',
        category: 'weapon',
        maxStackSize: 1,
        isStackable: false,
        durability: 59,
        toolType: 'sword',
        damage: 4,
      },
    ],
    [
      ItemId('minecraft:stone_sword'),
      {
        id: ItemId('minecraft:stone_sword'),
        name: 'Stone Sword',
        category: 'weapon',
        maxStackSize: 1,
        isStackable: false,
        durability: 131,
        toolType: 'sword',
        damage: 5,
      },
    ],
    [
      ItemId('minecraft:iron_sword'),
      {
        id: ItemId('minecraft:iron_sword'),
        name: 'Iron Sword',
        category: 'weapon',
        maxStackSize: 1,
        isStackable: false,
        durability: 250,
        toolType: 'sword',
        damage: 6,
      },
    ],
    [
      ItemId('minecraft:diamond_sword'),
      {
        id: ItemId('minecraft:diamond_sword'),
        name: 'Diamond Sword',
        category: 'weapon',
        maxStackSize: 1,
        isStackable: false,
        durability: 1561,
        toolType: 'sword',
        damage: 7,
      },
    ],

    // Armor
    [
      ItemId('minecraft:iron_helmet'),
      {
        id: ItemId('minecraft:iron_helmet'),
        name: 'Iron Helmet',
        category: 'armor',
        maxStackSize: 1,
        isStackable: false,
        durability: 165,
        armorType: 'helmet',
        armorValue: 2,
      },
    ],
    [
      ItemId('minecraft:iron_chestplate'),
      {
        id: ItemId('minecraft:iron_chestplate'),
        name: 'Iron Chestplate',
        category: 'armor',
        maxStackSize: 1,
        isStackable: false,
        durability: 240,
        armorType: 'chestplate',
        armorValue: 6,
      },
    ],
    [
      ItemId('minecraft:iron_leggings'),
      {
        id: ItemId('minecraft:iron_leggings'),
        name: 'Iron Leggings',
        category: 'armor',
        maxStackSize: 1,
        isStackable: false,
        durability: 225,
        armorType: 'leggings',
        armorValue: 5,
      },
    ],
    [
      ItemId('minecraft:iron_boots'),
      {
        id: ItemId('minecraft:iron_boots'),
        name: 'Iron Boots',
        category: 'armor',
        maxStackSize: 1,
        isStackable: false,
        durability: 195,
        armorType: 'boots',
        armorValue: 2,
      },
    ],
    [
      ItemId('minecraft:diamond_helmet'),
      {
        id: ItemId('minecraft:diamond_helmet'),
        name: 'Diamond Helmet',
        category: 'armor',
        maxStackSize: 1,
        isStackable: false,
        durability: 363,
        armorType: 'helmet',
        armorValue: 3,
      },
    ],

    // Food
    [
      ItemId('minecraft:apple'),
      {
        id: ItemId('minecraft:apple'),
        name: 'Apple',
        category: 'food',
        maxStackSize: 64,
        isStackable: true,
        foodValue: 4,
        saturation: 2.4,
      },
    ],
    [
      ItemId('minecraft:bread'),
      {
        id: ItemId('minecraft:bread'),
        name: 'Bread',
        category: 'food',
        maxStackSize: 64,
        isStackable: true,
        foodValue: 5,
        saturation: 6,
      },
    ],

    // Materials
    [
      ItemId('minecraft:stick'),
      {
        id: ItemId('minecraft:stick'),
        name: 'Stick',
        category: 'material',
        maxStackSize: 64,
        isStackable: true,
      },
    ],
    [
      ItemId('minecraft:coal'),
      {
        id: ItemId('minecraft:coal'),
        name: 'Coal',
        category: 'material',
        maxStackSize: 64,
        isStackable: true,
      },
    ],
    [
      ItemId('minecraft:iron_ingot'),
      {
        id: ItemId('minecraft:iron_ingot'),
        name: 'Iron Ingot',
        category: 'material',
        maxStackSize: 64,
        isStackable: true,
      },
    ],
    [
      ItemId('minecraft:diamond'),
      {
        id: ItemId('minecraft:diamond'),
        name: 'Diamond',
        category: 'material',
        maxStackSize: 64,
        isStackable: true,
      },
    ],
    [
      ItemId('minecraft:shield'),
      {
        id: ItemId('minecraft:shield'),
        name: 'Shield',
        category: 'tool',
        maxStackSize: 1,
        isStackable: false,
        durability: 336,
      },
    ],
  ]),
}

const getState = () => registryState
const setState = (newState: RegistryState) => {
  registryState = newState
}
