import { Schema } from '@effect/schema'
import { HashMap, Option, pipe } from 'effect'
import * as Array_ from 'effect/Array'
import type {
  BlockId,
  BurnTime,
  ItemId,
  Material,
  MaterialCollection,
  ToolEfficiency,
  ToolEfficiencyCollection,
} from './types'
import {
  MaterialCollection as MaterialCollectionSchema,
  ToolEfficiencyCollection as ToolEfficiencyCollectionSchema,
} from './types'

const decodeMaterials = Schema.decodeUnknownSync(MaterialCollectionSchema)
const decodeEfficiencies = Schema.decodeUnknownSync(ToolEfficiencyCollectionSchema)

const materialsSource: MaterialCollection = decodeMaterials([
  {
    id: 'stone',
    blockId: 'minecraft:stone',
    defaultItemId: 'minecraft:stone',
    category: 'stone',
    hardness: 1.5,
    blastResistance: 6,
    luminance: 0,
    tool: {
      required: true,
      preferredTypes: ['pickaxe'],
      minimumLevel: 0,
    },
    drops: [{ itemId: 'minecraft:cobblestone', amount: 1 }],
    tags: ['overworld', 'solid'],
  },
  {
    id: 'oak_log',
    blockId: 'minecraft:oak_log',
    defaultItemId: 'minecraft:oak_log',
    category: 'wood',
    hardness: 2,
    blastResistance: 3,
    luminance: 0,
    tool: {
      required: false,
      preferredTypes: ['axe'],
      minimumLevel: 0,
    },
    drops: [{ itemId: 'minecraft:oak_log', amount: 1 }],
    burnTime: 300,
    tags: ['overworld', 'flammable'],
  },
  {
    id: 'diamond_ore',
    blockId: 'minecraft:diamond_ore',
    defaultItemId: 'minecraft:diamond',
    category: 'stone',
    hardness: 3,
    blastResistance: 3,
    luminance: 0,
    tool: {
      required: true,
      preferredTypes: ['pickaxe'],
      minimumLevel: 2,
    },
    drops: [{ itemId: 'minecraft:diamond', amount: 1 }],
    tags: ['overworld', 'ore'],
  },
  {
    id: 'obsidian',
    blockId: 'minecraft:obsidian',
    defaultItemId: 'minecraft:obsidian',
    category: 'stone',
    hardness: 50,
    blastResistance: 1200,
    luminance: 0,
    tool: {
      required: true,
      preferredTypes: ['pickaxe'],
      minimumLevel: 3,
    },
    drops: [{ itemId: 'minecraft:obsidian', amount: 1 }],
    tags: ['overworld', 'portal'],
  },
  {
    id: 'sand',
    blockId: 'minecraft:sand',
    defaultItemId: 'minecraft:sand',
    category: 'sand',
    hardness: 0.5,
    blastResistance: 0.5,
    luminance: 0,
    tool: {
      required: false,
      preferredTypes: ['shovel'],
      minimumLevel: 0,
    },
    drops: [{ itemId: 'minecraft:sand', amount: 1 }],
    tags: ['overworld', 'gravity'],
  },
  {
    id: 'oak_leaves',
    blockId: 'minecraft:oak_leaves',
    defaultItemId: 'minecraft:oak_leaves',
    category: 'leaves',
    hardness: 0.2,
    blastResistance: 0.2,
    luminance: 0,
    tool: {
      required: false,
      preferredTypes: ['shears'],
      minimumLevel: 0,
    },
    drops: [{ itemId: 'minecraft:oak_sapling', amount: 1 }],
    burnTime: 100,
    tags: ['overworld', 'foliage'],
  },
])

const efficiencySource: ToolEfficiencyCollection = decodeEfficiencies([
  {
    toolType: 'pickaxe',
    toolMaterial: 'netherite',
    targetCategory: 'stone',
    speedMultiplier: 9,
    canHarvest: true,
  },
  {
    toolType: 'pickaxe',
    toolMaterial: 'diamond',
    targetCategory: 'stone',
    speedMultiplier: 8,
    canHarvest: true,
  },
  {
    toolType: 'pickaxe',
    toolMaterial: 'iron',
    targetCategory: 'stone',
    speedMultiplier: 6,
    canHarvest: true,
  },
  {
    toolType: 'pickaxe',
    toolMaterial: 'stone',
    targetCategory: 'stone',
    speedMultiplier: 4,
    canHarvest: true,
  },
  {
    toolType: 'pickaxe',
    toolMaterial: 'wood',
    targetCategory: 'stone',
    speedMultiplier: 2,
    canHarvest: true,
  },
  {
    toolType: 'axe',
    toolMaterial: 'diamond',
    targetCategory: 'wood',
    speedMultiplier: 8,
    canHarvest: true,
  },
  {
    toolType: 'axe',
    toolMaterial: 'iron',
    targetCategory: 'wood',
    speedMultiplier: 6,
    canHarvest: true,
  },
  {
    toolType: 'axe',
    toolMaterial: 'stone',
    targetCategory: 'wood',
    speedMultiplier: 4,
    canHarvest: true,
  },
  {
    toolType: 'axe',
    toolMaterial: 'wood',
    targetCategory: 'wood',
    speedMultiplier: 2,
    canHarvest: true,
  },
  {
    toolType: 'shovel',
    toolMaterial: 'diamond',
    targetCategory: 'sand',
    speedMultiplier: 8,
    canHarvest: true,
  },
  {
    toolType: 'shovel',
    toolMaterial: 'iron',
    targetCategory: 'sand',
    speedMultiplier: 6,
    canHarvest: true,
  },
  {
    toolType: 'shovel',
    toolMaterial: 'stone',
    targetCategory: 'sand',
    speedMultiplier: 4,
    canHarvest: true,
  },
  {
    toolType: 'shovel',
    toolMaterial: 'wood',
    targetCategory: 'sand',
    speedMultiplier: 2,
    canHarvest: true,
  },
  {
    toolType: 'shears',
    toolMaterial: 'iron',
    targetCategory: 'leaves',
    speedMultiplier: 5,
    canHarvest: true,
  },
  {
    toolType: 'shears',
    toolMaterial: 'diamond',
    targetCategory: 'leaves',
    speedMultiplier: 6,
    canHarvest: true,
  },
])

const tuple = <A, B>(a: A, b: B): readonly [A, B] => [a, b]

const toBlockEntry = (material: Material): readonly [BlockId, Material] => tuple(material.blockId, material)
const emptyBurnEntries: ReadonlyArray.ReadonlyArray<readonly [ItemId, BurnTime]> = []
const singleton = <A>(value: A): ReadonlyArray.ReadonlyArray<A> => [value]

const toBurnEntry = (material: Material): ReadonlyArray.ReadonlyArray<readonly [ItemId, BurnTime]> =>
  pipe(
    Option.fromNullable(material.burnTime),
    Option.match({
      onNone: () => emptyBurnEntries,
      onSome: (burn) => singleton(tuple(material.defaultItemId, burn)),
    })
  )

const efficiencyKey = (efficiency: ToolEfficiency): string =>
  `${efficiency.toolType}|${efficiency.toolMaterial}|${efficiency.targetCategory}`

const toEfficiencyEntry = (efficiency: ToolEfficiency): readonly [string, ToolEfficiency] =>
  tuple(efficiencyKey(efficiency), efficiency)

export const materialCatalog = materialsSource

export const materialByBlockId = HashMap.fromIterable(pipe(materialCatalog, Array_.map(toBlockEntry)))

export const burnTimeByItemId = HashMap.fromIterable(pipe(materialCatalog, Array_.flatMap(toBurnEntry)))

export const toolEfficiencyByKey = HashMap.fromIterable(pipe(efficiencySource, Array_.map(toEfficiencyEntry)))

export const getEfficiencyKey = (
  toolType: ToolEfficiency['toolType'],
  toolMaterial: ToolEfficiency['toolMaterial'],
  targetCategory: ToolEfficiency['targetCategory']
): string => `${toolType}|${toolMaterial}|${targetCategory}`
