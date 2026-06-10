import { Schema } from 'effect'

export const ItemTypeSchema = Schema.Literal(
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
  // Food items (Phase 11 — hunger restoration)
  'APPLE',
  'BREAD',
  'CARROT',
  'COOKED_PORKCHOP',
  'COOKED_BEEF',
  // Special food
  'GOLDEN_APPLE',
  // Fish — raw and cooked (fishing loot)
  'RAW_COD',
  'COOKED_COD',
  'RAW_SALMON',
  'COOKED_SALMON',
  'TROPICAL_FISH',
  'PUFFERFISH',
  // Farming items
  'WHEAT',
  'WHEAT_SEEDS',
  'BONE_MEAL',
  // Mob drops
  'RAW_BEEF',
  'LEATHER',
  'WOOL',
  'GUNPOWDER',
  'BONE',
  'ARROW',
  'STRING',
  'SPIDER_EYE',
  'ENDER_PEARL',
  // The End items
  'CHORUS_FRUIT',
  'DRAGON_BREATH',
  'DRAGON_EGG',
  'ELYTRA',
  'END_CRYSTAL',
  'ENDER_EYE',
  'POPPED_CHORUS_FRUIT',
  'SHULKER_SHELL',
  // Ranged weapons, tools & defensive items
  'BOW',
  'FISHING_ROD',
  'SHIELD',
  // Hoe tools — for tilling farmland
  'WOODEN_HOE',
  'STONE_HOE',
  'IRON_HOE',
  'DIAMOND_HOE',
  // Axe tools — wood chopping + combat
  'WOODEN_AXE',
  'STONE_AXE',
  'IRON_AXE',
  'DIAMOND_AXE',
  // Armor — leather tier
  'LEATHER_HELMET',
  'LEATHER_CHESTPLATE',
  'LEATHER_LEGGINGS',
  'LEATHER_BOOTS',
  // Armor — iron tier
  'IRON_HELMET',
  'IRON_CHESTPLATE',
  'IRON_LEGGINGS',
  'IRON_BOOTS',
  // Armor — diamond tier
  'DIAMOND_HELMET',
  'DIAMOND_CHESTPLATE',
  'DIAMOND_LEGGINGS',
  'DIAMOND_BOOTS',
  // Gravel drop — used in crafting FLINT_AND_STEEL
  'FLINT',
  // Portal ignition tool
  'FLINT_AND_STEEL',
  // Sheep-shearing tool (FR R11)
  'SHEARS',
  // Buckets (FR R26) — fluid pickup & placement
  'BUCKET',
  'WATER_BUCKET',
  'LAVA_BUCKET',
  // Fuel/crafting — smelted from WOOD logs (vanilla)
  'CHARCOAL',
)
export type ItemType = Schema.Schema.Type<typeof ItemTypeSchema>
