import type { InventoryItem } from '@ts-minecraft/core'
import { ITEM_TILE_MAP } from '@ts-minecraft/rendering'

export const SLOT_COLORS: Readonly<Partial<Record<InventoryItem, string>>> = {
  AIR: '#444444', GRASS: '#5a8a3a', DIRT: '#8b6344', STONE: '#888888',
  SAND: '#d4c77a', WATER: '#3f76be', WOOD: '#6b4423', LEAVES: '#2d5a1b',
  GLASS: '#c0e0f0', SNOW: '#f0f5ff', GRAVEL: '#7a6a5a', COBBLESTONE: '#606060',
  PLANKS: '#b88754', STICKS: '#d0b07a', CRAFTING_TABLE: '#8b5a2b', FURNACE: '#5c5c5c', TORCH: '#ffcf5a',
  COAL: '#262626', WOODEN_SWORD: '#c49a6c', WOODEN_PICKAXE: '#c49a6c', STONE_PICKAXE: '#9b9b9b', RAW_IRON: '#b38b6d', IRON_INGOT: '#cfcfcf', IRON_PICKAXE: '#cfcfcf', RAW_GOLD: '#c7a340', GOLD_INGOT: '#ffd75a', DIAMOND: '#71e0e0', REDSTONE_DUST: '#b02020', LAPIS_LAZULI: '#3456c0', EMERALD: '#2cc36b', DIAMOND_PICKAXE: '#71e0e0',
}

export const DEFAULT_SLOT_COLOR = '#333333'

// Resolve the tile PNG path for a given InventoryItem.
// Returns the URL to the individual tile image (e.g. "/textures/tile-01-stone.png").
const TILE_NAMES: Record<number, string> = {
  0: 'dirt', 1: 'stone', 2: 'wood-side', 3: 'wood-top', 4: 'grass-top', 5: 'grass-side',
  6: 'sand', 7: 'water', 8: 'leaves', 9: 'glass', 10: 'snow', 11: 'gravel',
  12: 'cobblestone', 13: 'granite', 14: 'diorite', 15: 'andesite', 16: 'deepslate',
  17: 'bedrock', 18: 'lava', 19: 'obsidian', 20: 'coal-ore', 21: 'iron-ore', 22: 'gold-ore',
  23: 'diamond-ore', 24: 'redstone-ore', 25: 'lapis-ore', 26: 'emerald-ore',
  27: 'deepslate-coal-ore', 28: 'deepslate-iron-ore', 29: 'deepslate-gold-ore',
  30: 'deepslate-diamond-ore', 31: 'deepslate-redstone-ore', 32: 'deepslate-lapis-ore',
  33: 'deepslate-emerald-ore', 34: 'coal-block', 35: 'iron-block', 36: 'gold-block',
  37: 'diamond-block', 38: 'redstone-block', 39: 'lapis-block', 40: 'emerald-block',
  41: 'planks', 43: 'crafting-table', 44: 'furnace', 45: 'torch',
  63: 'netherrack', 64: 'end-stone', 65: 'end-stone-bricks', 66: 'purpur-block',
  67: 'purpur-pillar-top', 68: 'purpur-pillar-side', 69: 'end-rod', 70: 'end-portal-frame',
  71: 'dragon-egg', 72: 'end-crystal', 73: 'ender-chest-top', 74: 'ender-chest-side',
  75: 'shulker-box', 76: 'bed-top', 77: 'bed-side', 78: 'tnt-top', 79: 'tnt-side',
  80: 'chorus-flower', 81: 'chorus-plant', 82: 'enchanting-table-top',
  83: 'enchanting-table-side', 84: 'farmland', 85: 'wheat-crop', 86: 'nether-portal',
  87: 'redstone-torch', 88: 'lever', 89: 'stone-button', 90: 'repeater',
  91: 'end-portal', 92: 'end-gateway',
  93: 'rotten-flesh', 94: 'apple', 95: 'bread', 96: 'carrot',
  97: 'cooked-porkchop', 98: 'golden-apple', 99: 'wheat',
  100: 'redstone-wire', 101: 'cobweb', 102: 'sapling', 103: 'dandelion',
  104: 'poppy', 105: 'brown-mushroom', 106: 'red-mushroom', 107: 'tall-grass',
  108: 'fern', 109: 'sugar-cane', 110: 'cactus', 111: 'lily-pad', 112: 'ice',
  113: 'glowstone',
  48: 'item-sticks', 49: 'item-coal', 50: 'item-wooden-sword', 51: 'item-wooden-pickaxe',
  52: 'item-stone-pickaxe', 53: 'item-raw-iron', 54: 'item-iron-ingot', 55: 'item-iron-pickaxe',
  56: 'item-raw-gold', 57: 'item-gold-ingot', 58: 'item-diamond', 59: 'item-redstone-dust',
  60: 'item-lapis-lazuli', 61: 'item-emerald', 62: 'item-diamond-pickaxe',
}

export const getTileImageUrl = (item: InventoryItem): string | null => {
  const tileIndex = ITEM_TILE_MAP[item]
  if (tileIndex === undefined || tileIndex < 0) return null
  const name = TILE_NAMES[tileIndex]
  if (!name) return null
  return `/textures/tile-${String(tileIndex).padStart(2, '0')}-${name}.png`
}

export const SLOT_EL_STYLE = [
  'width:48px', 'height:48px', 'border:2px solid #111',
  'background:#8b8b8b',
  'box-shadow:inset 2px 2px #f3f3f3,inset -2px -2px #373737',
  'cursor:pointer', 'position:relative', 'display:flex',
  'align-items:center', 'justify-content:center',
  'font-family:"Courier New",monospace', 'font-size:10px', 'color:#fff',
  'text-shadow:1px 1px #111', 'user-select:none',
  'image-rendering:pixelated',
].join(';')

export const OVERLAY_STYLE = [
  'position:fixed', 'top:50%', 'left:50%',
  'transform:translate(-50%,-50%)',
  'background:#c6c6c6', 'padding:14px',
  'border:2px solid #111',
  'box-shadow:inset 3px 3px #fff,inset -3px -3px #555,0 12px 0 rgba(0,0,0,0.35)',
  'z-index:999', 'display:none',
  'font-family:"Courier New",monospace', 'color:#202020',
  'image-rendering:pixelated',
].join(';')

export const OVERLAY_TITLE_STYLE = 'color:#202020;margin-bottom:10px;font-size:14px;text-align:center;font-weight:bold'
export const CHEST_SECTION_STYLE = 'display:none;margin-bottom:12px'
export const CHEST_TITLE_STYLE = 'color:#202020;margin-bottom:8px;font-size:13px;text-align:center;font-weight:bold'
export const CHEST_GRID_STYLE = 'display:grid;grid-template-columns:repeat(9,50px);gap:2px'
export const MAIN_GRID_STYLE = 'display:grid;grid-template-columns:repeat(9,50px);gap:2px;margin-bottom:8px'
export const HOTBAR_GRID_STYLE = 'display:grid;grid-template-columns:repeat(9,50px);gap:2px'
export const SEPARATOR_STYLE = 'border-color:#555;margin:8px 0'
export const CRAFTING_TITLE_STYLE = 'color:#202020;margin:12px 0 6px;font-size:13px;font-weight:bold'
export const CRAFTING_LIST_STYLE = 'display:flex;flex-direction:column;gap:3px;max-height:180px;overflow:auto'
export const STATUS_STYLE = 'font-size:12px;color:#333;margin-top:8px'
export const EMPTY_RECIPE_STYLE = 'color:#4a4a4a;font-size:12px'
export const RECIPE_ROW_BASE_STYLE = 'padding:6px 8px;color:#202020;text-align:left;cursor:pointer;border:2px solid #111;box-shadow:inset 2px 2px #eee,inset -2px -2px #555'
export const RECIPE_ROW_SELECTED_BG = '#b7d48a'
export const RECIPE_ROW_SELECTED_BORDER = '#ffffff'
export const RECIPE_ROW_DEFAULT_BG = '#9b9b9b'
export const RECIPE_ROW_DEFAULT_BORDER = '#111111'
export const SLOT_BORDER_SELECTED = '2px solid #ffffff'
export const SLOT_BORDER_DEFAULT = '2px solid #111'
