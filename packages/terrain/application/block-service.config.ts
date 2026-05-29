import { HashMap, HashSet, Option } from 'effect'
import type { BlockType, ItemType, InventoryItem } from '@ts-minecraft/kernel'
export {
  DIAMOND_PICKAXE_HARVESTABLE_BLOCKS,
  IRON_PICKAXE_HARVESTABLE_BLOCKS,
  STONE_PICKAXE_HARVESTABLE_BLOCKS,
  WOODEN_PICKAXE_HARVESTABLE_BLOCKS,
} from './harvestable-blocks'

export const NON_PLACEABLE_ITEM_TYPES: HashSet.HashSet<InventoryItem> = HashSet.fromIterable<InventoryItem>([
  'STICKS',
  'COAL',
  'WOODEN_SWORD',
  'STONE_SWORD',
  'IRON_SWORD',
  'DIAMOND_SWORD',
  'WOODEN_PICKAXE',
  'STONE_PICKAXE',
  'RAW_IRON',
  'IRON_INGOT',
  'IRON_PICKAXE',
  'RAW_GOLD',
  'GOLD_INGOT',
  'DIAMOND',
  'REDSTONE_DUST',
  'LAPIS_LAZULI',
  'EMERALD',
  'DIAMOND_PICKAXE',
  'ROTTEN_FLESH',
  // Food items are consumed, never placed as blocks.
  'APPLE',
  'RAW_COD',
  'COOKED_COD',
  'RAW_SALMON',
  'COOKED_SALMON',
  'TROPICAL_FISH',
  'PUFFERFISH',
  'BREAD',
  'CARROT',
  'COOKED_PORKCHOP',
  'COOKED_BEEF',
  'GOLDEN_APPLE',
  // New mob drops — not placeable
  'STRING',
  'SPIDER_EYE',
  'ENDER_PEARL',
  // Farming items
  'WHEAT',
  'WHEAT_SEEDS',
  'BONE_MEAL',
  // Ranged weapons, tools & defensive items — not placeable as blocks
  'BOW',
  'FISHING_ROD',
  'SHIELD',
  'WOODEN_HOE',
  'STONE_HOE',
  'IRON_HOE',
  'DIAMOND_HOE',
  'WOODEN_AXE',
  'STONE_AXE',
  'IRON_AXE',
  'DIAMOND_AXE',
  // Mob drops — not placeable
  'RAW_BEEF',
  'LEATHER',
  'WOOL',
  'GUNPOWDER',
  'BONE',
  'ARROW',
  // Armor — worn, not placed
  'LEATHER_HELMET',
  'LEATHER_CHESTPLATE',
  'LEATHER_LEGGINGS',
  'LEATHER_BOOTS',
  'IRON_HELMET',
  'IRON_CHESTPLATE',
  'IRON_LEGGINGS',
  'IRON_BOOTS',
  'DIAMOND_HELMET',
  'DIAMOND_CHESTPLATE',
  'DIAMOND_LEGGINGS',
  'DIAMOND_BOOTS',
])

export const INVENTORY_DROP_OVERRIDES: HashMap.HashMap<BlockType, InventoryItem> = HashMap.fromIterable<BlockType, InventoryItem>([
  ['STONE', 'COBBLESTONE'],
  ['COAL_ORE', 'COAL'],
  ['DEEPSLATE_COAL_ORE', 'COAL'],
  ['IRON_ORE', 'RAW_IRON'],
  ['DEEPSLATE_IRON_ORE', 'RAW_IRON'],
  ['GOLD_ORE', 'RAW_GOLD'],
  ['DEEPSLATE_GOLD_ORE', 'RAW_GOLD'],
  ['DIAMOND_ORE', 'DIAMOND'],
  ['DEEPSLATE_DIAMOND_ORE', 'DIAMOND'],
  ['REDSTONE_ORE', 'REDSTONE_DUST'],
  ['DEEPSLATE_REDSTONE_ORE', 'REDSTONE_DUST'],
  ['LAPIS_ORE', 'LAPIS_LAZULI'],
  ['DEEPSLATE_LAPIS_ORE', 'LAPIS_LAZULI'],
  ['EMERALD_ORE', 'EMERALD'],
  ['DEEPSLATE_EMERALD_ORE', 'EMERALD'],
])

export const getInventoryDropForBlock = (blockType: BlockType): InventoryItem =>
  Option.getOrElse(HashMap.get(INVENTORY_DROP_OVERRIDES, blockType), () => blockType)

export const PICKAXE_BLOCK_TYPES: HashSet.HashSet<ItemType> = HashSet.fromIterable<ItemType>([
  'WOODEN_PICKAXE',
  'STONE_PICKAXE',
  'IRON_PICKAXE',
  'DIAMOND_PICKAXE',
])
