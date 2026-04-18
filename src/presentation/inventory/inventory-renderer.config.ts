import type { BlockType } from '@/domain/block'

export const SLOT_COLORS: Readonly<Partial<Record<BlockType, string>>> = {
  AIR: '#444444', GRASS: '#5a8a3a', DIRT: '#8b6344', STONE: '#888888',
  SAND: '#d4c77a', WATER: '#3f76be', WOOD: '#6b4423', LEAVES: '#2d5a1b',
  GLASS: '#c0e0f0', SNOW: '#f0f5ff', GRAVEL: '#7a6a5a', COBBLESTONE: '#606060',
  PLANKS: '#b88754', STICKS: '#d0b07a', CRAFTING_TABLE: '#8b5a2b', FURNACE: '#5c5c5c', TORCH: '#ffcf5a',
  COAL: '#262626', WOODEN_SWORD: '#c49a6c',
}

export const DEFAULT_SLOT_COLOR = '#333333'

export const SLOT_EL_STYLE = [
  'width:48px', 'height:48px', 'border:2px solid #666',
  'cursor:pointer', 'position:relative', 'display:flex',
  'align-items:center', 'justify-content:center',
  'font-size:10px', 'color:#fff', 'user-select:none',
].join(';')

export const OVERLAY_STYLE = [
  'position:fixed', 'top:50%', 'left:50%',
  'transform:translate(-50%,-50%)',
  'background:rgba(0,0,0,0.85)', 'padding:16px',
  'border-radius:8px', 'z-index:999', 'display:none',
  'font-family:monospace',
].join(';')

export const OVERLAY_TITLE_STYLE = 'color:#fff;margin-bottom:10px;font-size:14px;text-align:center'
export const MAIN_GRID_STYLE = 'display:grid;grid-template-columns:repeat(9,50px);gap:4px;margin-bottom:8px'
export const HOTBAR_GRID_STYLE = 'display:grid;grid-template-columns:repeat(9,50px);gap:4px'
export const SEPARATOR_STYLE = 'border-color:#555;margin:8px 0'
export const CRAFTING_TITLE_STYLE = 'color:#fff;margin:12px 0 6px;font-size:13px'
export const CRAFTING_LIST_STYLE = 'display:flex;flex-direction:column;gap:4px;max-height:180px;overflow:auto'
export const STATUS_STYLE = 'font-size:12px;color:#b0b0b0;margin-top:8px'
export const EMPTY_RECIPE_STYLE = 'color:#aaa;font-size:12px'
export const RECIPE_ROW_BASE_STYLE = 'padding:6px 8px;border-radius:4px;color:#fff;text-align:left;cursor:pointer'
export const RECIPE_ROW_SELECTED_BG = '#2f4f2f'
export const RECIPE_ROW_SELECTED_BORDER = '#8fbc8f'
export const RECIPE_ROW_DEFAULT_BG = '#1f1f1f'
export const RECIPE_ROW_DEFAULT_BORDER = '#3d3d3d'
export const SLOT_BORDER_SELECTED = '2px solid #fff'
export const SLOT_BORDER_DEFAULT = '2px solid #666'
