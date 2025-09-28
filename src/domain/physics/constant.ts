/**
 * 物理エンジンの定数定義
 */
export const PHYSICS_CONSTANTS = {
  GRAVITY: 32.0, // blocks/s²
  TERMINAL_VELOCITY: 78.4, // blocks/s
  WATER_RESISTANCE: 0.8,
  LAVA_RESISTANCE: 0.5,
  AIR_RESISTANCE: 0.98,
  DEFAULT_FRICTION: 0.6,
} as const

/**
 * ブロック摩擦係数マップ
 */
export const BLOCK_FRICTION: Record<number, number> = {
  0: 0.6, // Air (default)
  1: 0.6, // Stone
  2: 0.6, // Grass
  3: 0.6, // Dirt
  4: 0.6, // Cobblestone
  5: 0.6, // Wood
  6: 0.6, // Sapling
  7: 0.6, // Bedrock
  8: 0.8, // Water (higher = less friction)
  9: 0.8, // Stationary water
  10: 0.5, // Lava
  11: 0.5, // Stationary lava
  12: 0.6, // Sand
  13: 0.6, // Gravel
  79: 0.98, // Ice (very slippery)
  174: 0.98, // Packed ice
} as const
