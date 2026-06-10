import { HashMap, HashSet, Option } from 'effect'
import type { BlockType, ItemType, InventoryItem } from '@ts-minecraft/core'
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
  // Gravel drop
  'FLINT',
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
  // Portal blocks — placed by ignition only, never from inventory
  'NETHER_PORTAL',
  // Portal ignition tool — activates portal frames, not placed as blocks
  'FLINT_AND_STEEL',
  // Shearing tool (R11) — used on sheep, not placed
  'SHEARS',
  // Buckets (R26) — fluid carriers; placement is handled by the bucket use-handler, not block placement
  'BUCKET',
  'WATER_BUCKET',
  'LAVA_BUCKET',
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
  ['GRASS', 'DIRT'],
  ['FARMLAND', 'DIRT'],
  // Unripe crops drop seeds; ripe crops get a bonus WHEAT added by the interaction handler
  // after querying CropGrowthService.harvest(). Unknown/village crops default to ripe.
  ['WHEAT_CROP', 'WHEAT_SEEDS'],
  // REDSTONE_WIRE (flat cable on ground) drops REDSTONE_DUST when broken.
  // REDSTONE_TORCH drops itself (you can place it again) — no override needed.
  ['REDSTONE_WIRE', 'REDSTONE_DUST'],
  // Gravel drops FLINT (deterministic; vanilla is 10% random but we keep drops pure/replayable).
  ['GRAVEL', 'FLINT'],
])

export const getInventoryDropForBlock = (blockType: BlockType): InventoryItem =>
  Option.getOrElse(HashMap.get(INVENTORY_DROP_OVERRIDES, blockType), () => blockType)

// R24: base (Fortune-independent) drop count per broken block. Vanilla drops
// multiple units from redstone (4-5) and lapis (4-9) ores; everything else
// drops 1. We use the deterministic vanilla *minimum* (4) — no RNG, so the
// break stays pure/replayable. The Fortune bonus is applied separately on top
// (interaction-block-handler) and is unchanged by this.
const BLOCK_BASE_DROP_COUNT: HashMap.HashMap<BlockType, number> = HashMap.fromIterable<BlockType, number>([
  ['REDSTONE_ORE', 4],
  ['DEEPSLATE_REDSTONE_ORE', 4],
  ['LAPIS_ORE', 4],
  ['DEEPSLATE_LAPIS_ORE', 4],
])

export const getBlockDropCount = (blockType: BlockType): number =>
  Option.getOrElse(HashMap.get(BLOCK_BASE_DROP_COUNT, blockType), () => 1)

export const PICKAXE_BLOCK_TYPES: HashSet.HashSet<ItemType> = HashSet.fromIterable<ItemType>([
  'WOODEN_PICKAXE',
  'STONE_PICKAXE',
  'IRON_PICKAXE',
  'DIAMOND_PICKAXE',
])

// Blocks that benefit from Fortune enchantment (ore drops that can be multiplied).
export const FORTUNE_ORE_BLOCKS: HashSet.HashSet<BlockType> = HashSet.fromIterable<BlockType>([
  'COAL_ORE', 'DEEPSLATE_COAL_ORE',
  'DIAMOND_ORE', 'DEEPSLATE_DIAMOND_ORE',
  'EMERALD_ORE', 'DEEPSLATE_EMERALD_ORE',
  'LAPIS_ORE', 'DEEPSLATE_LAPIS_ORE',
  'REDSTONE_ORE', 'DEEPSLATE_REDSTONE_ORE',
])
