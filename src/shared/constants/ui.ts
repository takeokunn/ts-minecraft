/**
 * UI and user interface constants
 */

// Input Constants
export const KEY_REPEAT_DELAY = 500 // milliseconds
export const KEY_REPEAT_RATE = 50 // milliseconds
export const MOUSE_SENSITIVITY = 0.002
export const TOUCH_SENSITIVITY = 0.005

// UI Layout Constants
export const DEBUG_PANEL_WIDTH = 300
export const DEBUG_PANEL_HEIGHT = 400
export const INVENTORY_SLOTS_PER_ROW = 9
export const HOTBAR_SLOTS = 9

// Animation Constants
export const DEFAULT_ANIMATION_DURATION = 300 // milliseconds
export const FADE_ANIMATION_DURATION = 150
export const SLIDE_ANIMATION_DURATION = 200

// Color Constants
export const COLORS = {
  PRIMARY: '#2563eb',
  SECONDARY: '#64748b',
  SUCCESS: '#10b981',
  WARNING: '#f59e0b',
  ERROR: '#ef4444',
  INFO: '#3b82f6',
  
  // UI Backgrounds
  PANEL_BACKGROUND: 'rgba(0, 0, 0, 0.8)',
  BUTTON_BACKGROUND: 'rgba(255, 255, 255, 0.1)',
  BUTTON_HOVER: 'rgba(255, 255, 255, 0.2)',
  
  // Text Colors
  TEXT_PRIMARY: '#ffffff',
  TEXT_SECONDARY: '#94a3b8',
  TEXT_MUTED: '#64748b',
} as const

// Z-Index Layers
export const Z_INDEX = {
  BASE: 0,
  TOOLTIP: 1000,
  MODAL: 2000,
  NOTIFICATION: 3000,
  DEBUG: 9000,
} as const