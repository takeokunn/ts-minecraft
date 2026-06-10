// Atlas tile index per blockId per face direction.
// Tile layout (16×16 grid):
//   0: dirt          1: stone          2: wood_side    3: wood_top
//   4: grass_top     5: grass_side     6: sand         7: water
//   8: leaves        9: glass          10: snow        11: gravel
//   12: cobblestone  13: granite       14: diorite     15: andesite
//   16: deepslate    17: bedrock       18: lava        19: obsidian
//   20-26: ores (coal, iron, gold, diamond, redstone, lapis, emerald)
//   27-33: deepslate ores (same order)
//   34-40: blocks (coal, iron, gold, diamond, redstone, lapis, emerald)
//   41-45: planks, sticks (item-only atlas tile), crafting table, furnace, torch
//   63-92: end/nether/decorative block texture tiles
// TILE_MAP is indexed by BlockType storage id only. Inventory-only atlas tiles
// such as sticks are not valid block ids and must not be inserted here.
export type TextureFaceDir = 'top' | 'bottom' | 'side'

export const TILE_MAP: ReadonlyArray<Readonly<Record<TextureFaceDir, number>>> = [
  { top: 0,  bottom: 0,  side: 0  }, //  0: AIR (unused)
  { top: 0,  bottom: 0,  side: 0  }, //  1: DIRT
  { top: 1,  bottom: 1,  side: 1  }, //  2: STONE
  { top: 3,  bottom: 3,  side: 2  }, //  3: WOOD (log: top=rings, side=bark)
  { top: 4,  bottom: 0,  side: 5  }, //  4: GRASS (top=green, bottom=dirt, sides=grass_side)
  { top: 6,  bottom: 6,  side: 6  }, //  5: SAND
  { top: 7,  bottom: 7,  side: 7  }, //  6: WATER
  { top: 8,  bottom: 8,  side: 8  }, //  7: LEAVES
  { top: 9,  bottom: 9,  side: 9  }, //  8: GLASS
  { top: 10, bottom: 10, side: 10 }, //  9: SNOW
  { top: 11, bottom: 11, side: 11 }, // 10: GRAVEL
  { top: 12, bottom: 12, side: 12 }, // 11: COBBLESTONE
  { top: 13, bottom: 13, side: 13 }, // 12: GRANITE
  { top: 14, bottom: 14, side: 14 }, // 13: DIORITE
  { top: 15, bottom: 15, side: 15 }, // 14: ANDESITE
  { top: 16, bottom: 16, side: 16 }, // 15: DEEPSLATE
  { top: 17, bottom: 17, side: 17 }, // 16: BEDROCK
  { top: 18, bottom: 18, side: 18 }, // 17: LAVA
  { top: 19, bottom: 19, side: 19 }, // 18: OBSIDIAN
  { top: 20, bottom: 20, side: 20 }, // 19: COAL_ORE
  { top: 21, bottom: 21, side: 21 }, // 20: IRON_ORE
  { top: 22, bottom: 22, side: 22 }, // 21: GOLD_ORE
  { top: 23, bottom: 23, side: 23 }, // 22: DIAMOND_ORE
  { top: 24, bottom: 24, side: 24 }, // 23: REDSTONE_ORE
  { top: 25, bottom: 25, side: 25 }, // 24: LAPIS_ORE
  { top: 26, bottom: 26, side: 26 }, // 25: EMERALD_ORE
  { top: 27, bottom: 27, side: 27 }, // 26: DEEPSLATE_COAL_ORE
  { top: 28, bottom: 28, side: 28 }, // 27: DEEPSLATE_IRON_ORE
  { top: 29, bottom: 29, side: 29 }, // 28: DEEPSLATE_GOLD_ORE
  { top: 30, bottom: 30, side: 30 }, // 29: DEEPSLATE_DIAMOND_ORE
  { top: 31, bottom: 31, side: 31 }, // 30: DEEPSLATE_REDSTONE_ORE
  { top: 32, bottom: 32, side: 32 }, // 31: DEEPSLATE_LAPIS_ORE
  { top: 33, bottom: 33, side: 33 }, // 32: DEEPSLATE_EMERALD_ORE
  { top: 34, bottom: 34, side: 34 }, // 33: COAL_BLOCK
  { top: 35, bottom: 35, side: 35 }, // 34: IRON_BLOCK
  { top: 36, bottom: 36, side: 36 }, // 35: GOLD_BLOCK
  { top: 37, bottom: 37, side: 37 }, // 36: DIAMOND_BLOCK
  { top: 38, bottom: 38, side: 38 }, // 37: REDSTONE_BLOCK
  { top: 39, bottom: 39, side: 39 }, // 38: LAPIS_BLOCK
  { top: 40, bottom: 40, side: 40 }, // 39: EMERALD_BLOCK
  { top: 41, bottom: 41, side: 41 }, // 40: PLANKS
  { top: 43, bottom: 43, side: 43 }, // 41: CRAFTING_TABLE
  { top: 44, bottom: 44, side: 44 }, // 42: FURNACE
  { top: 45, bottom: 45, side: 45 }, // 43: TORCH
  { top: 63, bottom: 63, side: 63 }, // 44: NETHERRACK
  { top: 86, bottom: 86, side: 86 }, // 45: NETHER_PORTAL
  { top: 84, bottom: 0,  side: 0  }, // 46: FARMLAND
  { top: 85, bottom: 85, side: 85 }, // 47: WHEAT_CROP
  { top: 100, bottom: 100, side: 100 }, // 48: REDSTONE_WIRE
  { top: 87, bottom: 87, side: 87 }, // 49: REDSTONE_TORCH
  { top: 88, bottom: 88, side: 88 }, // 50: LEVER
  { top: 89, bottom: 89, side: 89 }, // 51: STONE_BUTTON
  { top: 90, bottom: 90, side: 90 }, // 52: REPEATER
  { top: 76, bottom: 77, side: 77 }, // 53: BED
  { top: 82, bottom: 19, side: 83 }, // 54: ENCHANTING_TABLE
  { top: 64, bottom: 64, side: 64 }, // 55: END_STONE
  { top: 70, bottom: 70, side: 70 }, // 56: END_PORTAL_FRAME
  { top: 91, bottom: 91, side: 91 }, // 57: END_PORTAL
  { top: 78, bottom: 78, side: 79 }, // 58: TNT
  { top: 80, bottom: 80, side: 80 }, // 59: CHORUS_FLOWER
  { top: 81, bottom: 81, side: 81 }, // 60: CHORUS_PLANT
  { top: 71, bottom: 71, side: 71 }, // 61: DRAGON_EGG
  { top: 72, bottom: 72, side: 72 }, // 62: END_CRYSTAL
  { top: 92, bottom: 92, side: 92 }, // 63: END_GATEWAY
  { top: 69, bottom: 69, side: 69 }, // 64: END_ROD
  { top: 65, bottom: 65, side: 65 }, // 65: END_STONE_BRICKS
  { top: 73, bottom: 74, side: 74 }, // 66: ENDER_CHEST
  { top: 66, bottom: 66, side: 66 }, // 67: PURPUR_BLOCK
  { top: 67, bottom: 67, side: 68 }, // 68: PURPUR_PILLAR
  { top: 66, bottom: 66, side: 66 }, // 69: PURPUR_SLAB
  { top: 66, bottom: 66, side: 66 }, // 70: PURPUR_STAIRS
  { top: 75, bottom: 75, side: 75 }, // 71: SHULKER_BOX
]
