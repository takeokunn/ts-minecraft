/**
 * @fileoverview Block Interaction Domain Module
 *
 * プレイヤーとブロック間のインタラクション機能を提供するドメインモジュール。
 * レイキャスト、ブロック破壊、ブロック設置の包括的な実装を含む。
 *
 * ## 主要コンポーネント
 *
 * ### BlockInteractionService
 * - レイキャスト実行（DDAアルゴリズム）
 * - ブロック破壊セッション管理
 * - ブロック設置と検証
 * - インタラクト可能ブロック検索
 *
 * ### Raycast Module
 * - 高性能DDA（Digital Differential Analyzer）アルゴリズム
 * - Minecraft準拠のボクセル走査
 * - ブロック面検出と衝突計算
 *
 * ### BlockBreaking Module
 * - Minecraft準拠の破壊時間計算
 * - ツール効率とブロック硬度システム
 * - 破壊アニメーションサポート
 * - セッション管理と進捗追跡
 *
 * ### BlockPlacement Module
 * - 包括的設置バリデーション
 * - 支持ブロック・環境条件チェック
 * - プレイヤー衝突検出
 * - 一括設置機能
 *
 * ## 使用例
 *
 * ```typescript
 * import { BlockInteractionService, BlockInteractionServiceLive } from '@domain/interaction'
 *
 * const program = Effect.gen(function* () {
 *   const service = yield* BlockInteractionService
 *
 *   // レイキャスト実行
 *   const raycastResult = yield* service.performRaycast(
 *     { x: 0, y: 64, z: 0 },    // プレイヤー位置
 *     { x: 1, y: 0, z: 0 },    // 視線方向
 *     10                        // 最大距離
 *   )
 *
 *   if (raycastResult.hit) {
 *     // ブロック破壊開始
 *     const session = yield* service.startBlockBreaking(
 *       playerId,
 *       raycastResult.blockPosition!,
 *       'pickaxe'
 *     )
 *
 *     console.log(`破壊開始: ${session.totalBreakTime}秒`)
 *   }
 * })
 *
 * // サービスを提供して実行
 * const runnable = program.pipe(
 *   Effect.provide(BlockInteractionServiceLive)
 * )
 * ```
 *
 * ## アーキテクチャ特徴
 *
 * - **Effect-TS準拠**: 純粋関数型プログラミング
 * - **Schema-First**: 実行時型検証
 * - **エラーハンドリング**: 構造化エラーシステム
 * - **テスタビリティ**: 依存注入とモック対応
 * - **パフォーマンス**: 高効率アルゴリズム実装
 *
 * @author Claude Code
 * @since 2024-01-15
 */

// =============================================================================
// Core Service Interface & Implementation
// =============================================================================

export {
  BlockInteractionService,
  type BlockInteractionService as IBlockInteractionService,
} from './BlockInteractionService'

export {
  BlockInteractionServiceLive,
  BlockInteractionServiceLiveWithDependencies,
  type BlockInteractionServiceLiveType,
} from './BlockInteractionServiceLive'

// =============================================================================
// Type Definitions
// =============================================================================

export type {
  Vector3,
  BlockFace,
  ToolType,
  RaycastResult,
  BreakingSession,
  BreakingProgress,
  PlacementResult,
  InteractableBlock,
} from './InteractionTypes'

export {
  Vector3Schema,
  BlockFaceSchema,
  ToolTypeSchema,
  RaycastResultSchema,
  BreakingSessionSchema,
  BreakingProgressSchema,
  PlacementResultSchema,
  InteractableBlockSchema,
  validateVector3,
  validateBlockFace,
  validateToolType,
  validateRaycastResult,
  validateBreakingSession,
  validateBreakingProgress,
  validatePlacementResult,
  validateInteractableBlock,
  createEmptyRaycastResult,
  createHitRaycastResult,
  createSuccessfulPlacement,
  createFailedPlacement,
} from './InteractionTypes'

// =============================================================================
// Error Definitions
// =============================================================================

export type { InteractionError } from './InteractionErrors'

export {
  RaycastError,
  BlockBreakingError,
  BlockPlacementError,
  BreakingSessionError,
  InteractionValidationError,
  createRaycastError,
  createBlockBreakingError,
  createBlockPlacementError,
  createBreakingSessionError,
  createInteractionValidationError,
  isRaycastError,
  isBlockBreakingError,
  isBlockPlacementError,
  isBreakingSessionError,
  isInteractionValidationError,
  isInteractionError,
} from './InteractionErrors'

// =============================================================================
// Raycast Module
// =============================================================================

export {
  performDDARaycast,
  performPlayerRaycast,
  hasObstacleBetween,
  performRaycastWithDebug,
  type RaycastDebugInfo,
} from './Raycast'

// =============================================================================
// Block Breaking Module
// =============================================================================

export {
  calculateBlockBreakTime,
  startBlockBreaking,
  updateBlockBreaking,
  getBreakingSession,
  getPlayerBreakingSession,
  cancelBreakingSession,
  getAllBreakingSessions,
  calculateBreakingAnimationStage,
  generateBreakingParticleParams,
  getBreakingSessionStats,
  clearAllBreakingSessions,
  type BreakingParticleParams,
  type BreakingSessionStats,
} from './BlockBreaking'

// =============================================================================
// Block Placement Module
// =============================================================================

export {
  placeBlock,
  placeBatchBlocks,
  calculateOptimalPlacementPosition,
  checkPlacementViability,
  getPlacementRuleDebugInfo,
  scanPlaceablePositions,
  type BatchPlacementRequest,
} from './BlockPlacement'

// =============================================================================
// Convenience Re-exports
// =============================================================================

/**
 * 最も頻繁に使用される機能の便利なエイリアス
 */
export {
  performDDARaycast as raycast,
  performPlayerRaycast as playerRaycast,
  startBlockBreaking as breakBlock,
  placeBlock as placeBlockAt,
} from './index'

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
import type { Vector3, BlockFace, ToolType } from './InteractionTypes'

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
