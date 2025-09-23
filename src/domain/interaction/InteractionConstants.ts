/**
 * @fileoverview Block Interaction Domain Constants and Type Guards
 */

import type { Vector3, BlockFace, ToolType } from './InteractionTypes'

// =============================================================================
// Module Constants
// =============================================================================

/**
 * ブロックインタラクションの標準定数
 */
export const INTERACTION_CONSTANTS = {
  /** 標準的なプレイヤーリーチ距離（ブロック） */
  DEFAULT_REACH_DISTANCE: 5.0,

  /** 最大レイキャスト距離（ブロック） */
  MAX_RAYCAST_DISTANCE: 100.0,

  /** 破壊アニメーションのステージ数 */
  BREAKING_ANIMATION_STAGES: 10,

  /** 最小破壊時間（秒） */
  MIN_BREAK_TIME: 0.05,

  /** 最大破壊時間（秒） */
  MAX_BREAK_TIME: 60.0,

  /** インタラクト可能ブロック検索の最大範囲 */
  MAX_INTERACTABLE_RANGE: 32,

  /** ワールド境界（Far Lands） */
  WORLD_BORDER: 30000000,

  /** 最大高度 */
  MAX_HEIGHT: 256,

  /** ベッドロック高度 */
  BEDROCK_HEIGHT: 0,
} as const

/**
 * ブロック破壊に関する標準設定
 */
export const BREAKING_CONSTANTS = {
  /** 硬度係数（Minecraft準拠） */
  HARDNESS_MULTIPLIER: 1.5,

  /** 素手での基本破壊効率 */
  HAND_BASE_EFFICIENCY: 1.0,

  /** ツールの基本破壊効率 */
  TOOL_BASE_EFFICIENCY: 4.0,

  /** 適正ツールの効率係数 */
  PROPER_TOOL_EFFICIENCY: 1.0,

  /** 不適正ツールの効率係数 */
  IMPROPER_TOOL_EFFICIENCY: 0.25,

  /** 標準効率係数 */
  NEUTRAL_TOOL_EFFICIENCY: 0.5,
} as const

/**
 * ブロック設置に関する標準設定
 */
export const PLACEMENT_CONSTANTS = {
  /** 最小光レベル（多くの植物用） */
  MIN_LIGHT_LEVEL_PLANTS: 8,

  /** 成長に必要な光レベル（草等） */
  GROWTH_LIGHT_LEVEL: 9,

  /** 最大光レベル */
  MAX_LIGHT_LEVEL: 15,

  /** 水位高度（仮） */
  SEA_LEVEL: 62,

  /** プレイヤー高さ（ブロック） */
  PLAYER_HEIGHT: 2,
} as const

// =============================================================================
// Type Guards for Runtime Checking
// =============================================================================

/**
 * 実行時型チェック用のガード関数群
 */
export const InteractionTypeGuards = {
  /**
   * Vector3型かどうかをチェック
   */
  isVector3: (value: unknown): value is Vector3 => {
    return (
      typeof value === 'object' &&
      value !== null &&
      'x' in value &&
      typeof (value as any).x === 'number' &&
      'y' in value &&
      typeof (value as any).y === 'number' &&
      'z' in value &&
      typeof (value as any).z === 'number'
    )
  },

  /**
   * BlockFace型かどうかをチェック
   */
  isBlockFace: (value: unknown): value is BlockFace => {
    return typeof value === 'string' && ['top', 'bottom', 'north', 'south', 'east', 'west'].includes(value)
  },

  /**
   * ToolType型かどうかをチェック
   */
  isToolType: (value: unknown): value is ToolType => {
    return typeof value === 'string' && ['pickaxe', 'shovel', 'axe', 'hoe', 'sword', 'shears', 'hand'].includes(value)
  },
} as const

// =============================================================================
// Convenience Aliases
// =============================================================================

/**
 * 最も頻繁に使用される機能の便利なエイリアス
 */
export { performDDARaycast as raycast, performPlayerRaycast as playerRaycast } from './Raycast'
export { startBlockBreaking as breakBlock } from './BlockBreaking'
export { placeBlock as placeBlockAt } from './BlockPlacement'
