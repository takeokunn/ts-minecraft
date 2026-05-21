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
export const ITEM_TILE_MAP = {
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
};
//# sourceMappingURL=../../../../dist/packages/rendering/infrastructure/textures/item-texture-map.config.js.map