// Atlas tile index per blockId per face direction.
// Tile layout (16×16 grid):
//   0: dirt          1: stone          2: wood_side    3: wood_top
//   4: grass_top     5: grass_side     6: sand         7: water
//   8: leaves        9: glass          10: snow        11: gravel
//   12: cobblestone  13: granite       14: diorite     15: andesite
//   16: deepslate    17: bedrock       18: lava/fire   19: obsidian
//   20-26: ores (coal, iron, gold, diamond, redstone, lapis, emerald)
//   27-33: deepslate ores (same order)
//   34-40: blocks (coal, iron, gold, diamond, redstone, lapis, emerald)
//   41-45: planks, sticks (item-only atlas tile), crafting table, furnace, torch
//   63-92: end/nether/decorative/storage block texture tiles
//   100-115: redstone wire, cobweb, plants, cactus, lily pad, ice, glowstone, potato crop
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
  { top: 115, bottom: 115, side: 115 }, // 48: POTATO_CROP
  { top: 100, bottom: 100, side: 100 }, // 49: REDSTONE_WIRE
  { top: 87, bottom: 87, side: 87 }, // 50: REDSTONE_TORCH
  { top: 88, bottom: 88, side: 88 }, // 51: LEVER
  { top: 89, bottom: 89, side: 89 }, // 52: STONE_BUTTON
  { top: 90, bottom: 90, side: 90 }, // 53: REPEATER
  { top: 76, bottom: 77, side: 77 }, // 54: BED
  { top: 82, bottom: 19, side: 83 }, // 55: ENCHANTING_TABLE
  { top: 64, bottom: 64, side: 64 }, // 56: END_STONE
  { top: 70, bottom: 70, side: 70 }, // 57: END_PORTAL_FRAME
  { top: 91, bottom: 91, side: 91 }, // 58: END_PORTAL
  { top: 78, bottom: 78, side: 79 }, // 59: TNT
  { top: 80, bottom: 80, side: 80 }, // 60: CHORUS_FLOWER
  { top: 81, bottom: 81, side: 81 }, // 61: CHORUS_PLANT
  { top: 71, bottom: 71, side: 71 }, // 62: DRAGON_EGG
  { top: 72, bottom: 72, side: 72 }, // 63: END_CRYSTAL
  { top: 92, bottom: 92, side: 92 }, // 64: END_GATEWAY
  { top: 69, bottom: 69, side: 69 }, // 65: END_ROD
  { top: 65, bottom: 65, side: 65 }, // 66: END_STONE_BRICKS
  { top: 73, bottom: 74, side: 74 }, // 67: ENDER_CHEST
  { top: 66, bottom: 66, side: 66 }, // 68: PURPUR_BLOCK
  { top: 67, bottom: 67, side: 68 }, // 69: PURPUR_PILLAR
  { top: 66, bottom: 66, side: 66 }, // 70: PURPUR_SLAB
  { top: 66, bottom: 66, side: 66 }, // 71: PURPUR_STAIRS
  { top: 75, bottom: 75, side: 75 }, // 72: SHULKER_BOX
  { top: 73, bottom: 74, side: 74 }, // 73: CHEST
  { top: 41, bottom: 41, side: 41 }, // 74: DOOR (simplified full-cube render)
  { top: 41, bottom: 41, side: 41 }, // 75: DOOR_OPEN (interaction state)
  { top: 113, bottom: 113, side: 113 }, // 76: GLOWSTONE
  { top: 41, bottom: 41, side: 41 }, // 77: LADDER (simplified full-cube render)
  { top: 101, bottom: 101, side: 101 }, // 78: COBWEB
  { top: 102, bottom: 102, side: 102 }, // 79: SAPLING
  { top: 103, bottom: 103, side: 103 }, // 80: DANDELION
  { top: 104, bottom: 104, side: 104 }, // 81: POPPY
  { top: 105, bottom: 105, side: 105 }, // 82: BROWN_MUSHROOM
  { top: 106, bottom: 106, side: 106 }, // 83: RED_MUSHROOM
  { top: 107, bottom: 107, side: 107 }, // 84: TALL_GRASS
  { top: 108, bottom: 108, side: 108 }, // 85: FERN
  { top: 109, bottom: 109, side: 109 }, // 86: SUGAR_CANE
  { top: 110, bottom: 110, side: 110 }, // 87: CACTUS
  { top: 111, bottom: 111, side: 111 }, // 88: LILY_PAD
  { top: 112, bottom: 112, side: 112 }, // 89: ICE
  { top: 1, bottom: 1, side: 1 }, // 90: PRESSURE_PLATE (stone tile)
  { top: 1, bottom: 1, side: 1 }, // 91: STONE_SLAB (stone tile)
  { top: 41, bottom: 41, side: 41 }, // 92: OAK_STAIRS (planks tile)
  { top: 133, bottom: 133, side: 133 }, // 93: ANVIL
  { top: 134, bottom: 134, side: 134 }, // 94: CAULDRON
  { top: 18, bottom: 18, side: 18 }, // 95: FIRE (lava tile)
  { top: 134, bottom: 134, side: 134 }, // 96: WATER_CAULDRON
  { top: 132, bottom: 132, side: 132 }, // 97: RAIL
  { top: 130, bottom: 1, side: 131 }, // 98: PISTON (plank face, stone body)
  { top: 116, bottom: 116, side: 116 }, // 99: REDSTONE_LAMP
  { top: 117, bottom: 117, side: 117 }, // 100: REDSTONE_LAMP_LIT
  { top: 121, bottom: 121, side: 121 }, // 101: BREWING_STAND
  { top: 122, bottom: 122, side: 122 }, // 102: NETHER_BRICK
  { top: 125, bottom: 125, side: 125 }, // 103: END_PORTAL_FRAME_FILLED (socketed-eye tile)
  { top: 126, bottom: 126, side: 126 }, // 104: SOUL_SAND
  { top: 127, bottom: 127, side: 127 }, // 105: NETHER_WART_CROP
  { top: 135, bottom: 135, side: 135 }, // 106: SANDSTONE
  { top: 136, bottom: 136, side: 136 }, // 107: PRISMARINE
  { top: 140, bottom: 1, side: 140 }, // 108: OBSERVER (watch-face tile, stone bottom)
]
