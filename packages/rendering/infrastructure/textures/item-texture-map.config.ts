import type { InventoryItem } from '@ts-minecraft/core'

// Maps every InventoryItem (BlockType | ItemType) to a single atlas tile index
// for use in inventory/hotbar rendering.
//
// BlockTypes reuse their "side" face tile from TILE_MAP.
// ItemTypes get dedicated tiles starting at index 48 (row 3 of the 16×16 atlas).
//
// Tile layout for items (row 3+):
//   48: STICKS          49: COAL            50: WOODEN_SWORD
//   51: WOODEN_PICKAXE  52: STONE_PICKAXE   53: RAW_IRON
//   54: IRON_INGOT      55: IRON_PICKAXE    56: RAW_GOLD
//   57: GOLD_INGOT      58: DIAMOND         59: REDSTONE_DUST
//   60: LAPIS_LAZULI    61: EMERALD         62: DIAMOND_PICKAXE
//   63: ROTTEN_FLESH
export const ITEM_TILE_MAP: Readonly<Record<InventoryItem, number>> = {
  // BlockTypes — reuse side tile from TILE_MAP
  // AIR intentionally has no icon; callers should treat negative indices as "no tile".
  AIR: -1,
  DIRT: 0,
  STONE: 1,
  WOOD: 2,
  GRASS: 5,
  SAND: 6,
  WATER: 7,
  LEAVES: 8,
  GLASS: 9,
  SNOW: 10,
  GRAVEL: 11,
  COBBLESTONE: 12,
  GRANITE: 13,
  DIORITE: 14,
  ANDESITE: 15,
  DEEPSLATE: 16,
  BEDROCK: 17,
  LAVA: 18,
  OBSIDIAN: 19,
  COAL_ORE: 20,
  IRON_ORE: 21,
  GOLD_ORE: 22,
  DIAMOND_ORE: 23,
  REDSTONE_ORE: 24,
  LAPIS_ORE: 25,
  EMERALD_ORE: 26,
  DEEPSLATE_COAL_ORE: 27,
  DEEPSLATE_IRON_ORE: 28,
  DEEPSLATE_GOLD_ORE: 29,
  DEEPSLATE_DIAMOND_ORE: 30,
  DEEPSLATE_REDSTONE_ORE: 31,
  DEEPSLATE_LAPIS_ORE: 32,
  DEEPSLATE_EMERALD_ORE: 33,
  COAL_BLOCK: 34,
  IRON_BLOCK: 35,
  GOLD_BLOCK: 36,
  DIAMOND_BLOCK: 37,
  REDSTONE_BLOCK: 38,
  LAPIS_BLOCK: 39,
  EMERALD_BLOCK: 40,
  PLANKS: 41,
  CRAFTING_TABLE: 43,
  FURNACE: 44,
  TORCH: 45,

  // ItemTypes — dedicated tiles 48+
  STICKS: 48,
  COAL: 49,
  WOODEN_SWORD: 50,
  // STONE_SWORD / IRON_SWORD / DIAMOND_SWORD share the WOODEN_SWORD tile until
  // distinct atlas tiles are added in a future art pass.
  STONE_SWORD: 50,
  IRON_SWORD: 50,
  DIAMOND_SWORD: 50,
  WOODEN_PICKAXE: 51,
  STONE_PICKAXE: 52,
  RAW_IRON: 53,
  IRON_INGOT: 54,
  IRON_PICKAXE: 55,
  RAW_GOLD: 56,
  GOLD_INGOT: 57,
  DIAMOND: 58,
  REDSTONE_DUST: 59,
  LAPIS_LAZULI: 60,
  EMERALD: 61,
  DIAMOND_PICKAXE: 62,
  ROTTEN_FLESH: 63,
  // Food items — row 4 of the atlas (indices 64+)
  APPLE: 64,
  BREAD: 65,
  CARROT: 66,
  COOKED_PORKCHOP: 67,
  COOKED_BEEF: 67,    // same tile as COOKED_PORKCHOP until art pass
  GOLDEN_APPLE: 64,   // APPLE tile with golden colour (placeholder)
  // Fish items — share ROTTEN_FLESH tile (organic/raw) and COOKED_PORKCHOP (cooked)
  RAW_COD: 63,
  COOKED_COD: 67,
  RAW_SALMON: 63,
  COOKED_SALMON: 67,
  TROPICAL_FISH: 63,
  PUFFERFISH: 63,
  // Farming items
  WHEAT: 65,          // BREAD tile (wheat-yellow)
  WHEAT_SEEDS: 48,    // STICKS tile (small seeds placeholder)
  BONE_MEAL: 48,      // STICKS tile (white powder)
  // Mob drops — share nearby tiles until art pass adds dedicated sprites
  RAW_BEEF: 63,       // ROTTEN_FLESH tile (raw meat family)
  LEATHER: 49,        // COAL tile (dark material)
  WOOL: 48,           // STICKS tile (fluffy placeholder)
  GUNPOWDER: 49,      // COAL tile (dark powder)
  BONE: 48,           // STICKS tile (white stick)
  ARROW: 48,          // STICKS tile (thin shaft)
  STRING: 48,         // STICKS tile (thin thread)
  SPIDER_EYE: 63,     // ROTTEN_FLESH tile (organic)
  ENDER_PEARL: 61,    // EMERALD tile (green-ish gem)
  BOW: 48,            // STICKS tile (stick shape, placeholder)
  FISHING_ROD: 48,    // STICKS tile (rod shape)
  SHIELD: 54,         // IRON_INGOT tile (metal plate placeholder)
  // Hoe tools — share WOODEN_PICKAXE tile
  WOODEN_HOE: 51,
  STONE_HOE: 52,
  IRON_HOE: 55,
  DIAMOND_HOE: 62,
  // Axe tools — share pickaxe tiles (similar shape)
  WOODEN_AXE: 51,
  STONE_AXE: 52,
  IRON_AXE: 55,
  DIAMOND_AXE: 62,
  // Armor — leather tier (share COAL tile — tan-ish placeholder)
  LEATHER_HELMET: 49,
  LEATHER_CHESTPLATE: 49,
  LEATHER_LEGGINGS: 49,
  LEATHER_BOOTS: 49,
  // Armor — iron tier (share IRON_INGOT tile)
  IRON_HELMET: 54,
  IRON_CHESTPLATE: 54,
  IRON_LEGGINGS: 54,
  IRON_BOOTS: 54,
  // Armor — diamond tier (share DIAMOND tile)
  DIAMOND_HELMET: 58,
  DIAMOND_CHESTPLATE: 58,
  DIAMOND_LEGGINGS: 58,
  DIAMOND_BOOTS: 58,
}
