import type { BlockId, BlockPosition, PlayerId, SessionId } from '@domain/core/types/brands'
import type { Timestamp } from '@domain/core/types/time'
import { Schema } from '@effect/schema'

// =============================================================================
// Vector3 Schema
// =============================================================================

/**
 * 3次元ベクトル - レイキャストと位置計算用
 */
export const Vector3Schema = Schema.Struct({
  x: Schema.Number,
  y: Schema.Number,
  z: Schema.Number,
})

export type Vector3 = Schema.Schema.Type<typeof Vector3Schema>

// =============================================================================
// Block Face Schema
// =============================================================================

/**
 * ブロックの面を表す列挙型
 * Minecraftの標準的な面定義に準拠
 */
export const BlockFaceSchema = Schema.Literal(
  'top', // Y+ (上面)
  'bottom', // Y- (下面)
  'north', // Z- (北面)
  'south', // Z+ (南面)
  'east', // X+ (東面)
  'west' // X- (西面)
)

export type BlockFace = Schema.Schema.Type<typeof BlockFaceSchema>

// =============================================================================
// Tool Type Schema
// =============================================================================

/**
 * ツールタイプ - ブロック破壊効率計算用
 */
export const ToolTypeSchema = Schema.Union(
  Schema.Literal('pickaxe'), // つるはし
  Schema.Literal('shovel'), // シャベル
  Schema.Literal('axe'), // 斧
  Schema.Literal('hoe'), // クワ
  Schema.Literal('sword'), // 剣
  Schema.Literal('shears'), // ハサミ
  Schema.Literal('hand') // 素手
)

export type ToolType = Schema.Schema.Type<typeof ToolTypeSchema>

// =============================================================================
// Raycast Result Schema
// =============================================================================

/**
 * レイキャスト結果
 * hit: 衝突したかどうか
 * blockPosition: 衝突したブロックの位置（hitがtrueの場合）
 * face: 衝突した面（hitがtrueの場合）
 * distance: レイの開始点からの距離
 * point: 衝突点の正確な座標
 */
export const RaycastResultSchema = Schema.Struct({
  hit: Schema.Boolean,
  blockPosition: Schema.optional(
    Schema.Struct({
      x: Schema.Number,
      y: Schema.Number,
      z: Schema.Number,
    })
  ),
  face: Schema.optional(BlockFaceSchema),
  distance: Schema.Number,
  point: Vector3Schema,
})

export type RaycastResult = Schema.Schema.Type<typeof RaycastResultSchema>

// =============================================================================
// Breaking Session Schema
// =============================================================================

/**
 * ブロック破壊セッション
 * プレイヤーがブロックを破壊中の状態を追跡
 */
export const BreakingSessionSchema = Schema.Struct({
  sessionId: Schema.String,
  playerId: Schema.String,
  blockPosition: Schema.Struct({
    x: Schema.Number,
    y: Schema.Number,
    z: Schema.Number,
  }),
  toolType: Schema.Union(ToolTypeSchema, Schema.Null),
  startTime: Schema.Number,
  progress: Schema.Number.pipe(Schema.clamp(0, 1)), // 0-1の進捗率
  totalBreakTime: Schema.Number.pipe(Schema.positive()), // 完了に必要な総時間（秒）
})

// Runtime schema for validation
export type BreakingSession = {
  readonly sessionId: SessionId
  readonly playerId: PlayerId
  readonly blockPosition: BlockPosition
  readonly toolType: ToolType | null
  readonly startTime: Timestamp
  readonly progress: number
  readonly totalBreakTime: number
}

// =============================================================================
// Breaking Progress Schema
// =============================================================================

/**
 * ブロック破壊進捗
 * updateBlockBreaking の戻り値
 */
export const BreakingProgressSchema = Schema.Struct({
  sessionId: Schema.String,
  progress: Schema.Number.pipe(Schema.clamp(0, 1)),
  isComplete: Schema.Boolean,
  remainingTime: Schema.Number.pipe(Schema.nonNegative()), // 残り時間（秒）
})

export type BreakingProgress = {
  readonly sessionId: SessionId
  readonly progress: number
  readonly isComplete: boolean
  readonly remainingTime: number
}

// =============================================================================
// Placement Result Schema
// =============================================================================

/**
 * ブロック設置結果
 */
export const PlacementResultSchema = Schema.Struct({
  success: Schema.Boolean,
  placedPosition: Schema.optional(
    Schema.Struct({
      x: Schema.Number,
      y: Schema.Number,
      z: Schema.Number,
    })
  ),
  reason: Schema.optional(Schema.String), // 失敗理由
})

export type PlacementResult = {
  readonly success: boolean
  readonly placedPosition?: BlockPosition
  readonly reason?: string
}

// =============================================================================
// Interactable Block Schema
// =============================================================================

/**
 * インタラクト可能なブロック
 * 範囲内検索の結果
 */
export const InteractableBlockSchema = Schema.Struct({
  blockId: Schema.String,
  position: Schema.Struct({
    x: Schema.Number,
    y: Schema.Number,
    z: Schema.Number,
  }),
  distance: Schema.Number.pipe(Schema.nonNegative()),
  canBreak: Schema.Boolean,
  canInteract: Schema.Boolean,
})

export type InteractableBlock = {
  readonly blockId: BlockId
  readonly position: BlockPosition
  readonly distance: number
  readonly canBreak: boolean
  readonly canInteract: boolean
}

// =============================================================================
// Validation Functions
// =============================================================================

/**
 * Vector3の検証
 */
export const validateVector3 = Schema.decodeUnknown(Vector3Schema)

/**
 * BlockFaceの検証
 */
export const validateBlockFace = Schema.decodeUnknown(BlockFaceSchema)

/**
 * ToolTypeの検証
 */
export const validateToolType = Schema.decodeUnknown(ToolTypeSchema)

/**
 * RaycastResultの検証
 */
export const validateRaycastResult = Schema.decodeUnknown(RaycastResultSchema)

/**
 * BreakingSessionの検証
 */
export const validateBreakingSession = Schema.decodeUnknown(BreakingSessionSchema)

/**
 * BreakingProgressの検証
 */
export const validateBreakingProgress = Schema.decodeUnknown(BreakingProgressSchema)

/**
 * PlacementResultの検証
 */
export const validatePlacementResult = Schema.decodeUnknown(PlacementResultSchema)

/**
 * InteractableBlockの検証
 */
export const validateInteractableBlock = Schema.decodeUnknown(InteractableBlockSchema)

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * 空のRaycastResultを生成
 */
export const createEmptyRaycastResult = (distance: number, point: Vector3): RaycastResult => ({
  hit: false,
  blockPosition: undefined,
  face: undefined,
  distance,
  point,
})

/**
 * ヒットしたRaycastResultを生成
 */
export const createHitRaycastResult = (
  blockPosition: BlockPosition,
  face: BlockFace,
  distance: number,
  point: Vector3
): RaycastResult => ({
  hit: true,
  blockPosition: {
    x: blockPosition.x,
    y: blockPosition.y,
    z: blockPosition.z,
  },
  face,
  distance,
  point,
})

/**
 * 成功したPlacementResultを生成
 */
export const createSuccessfulPlacement = (position: BlockPosition): PlacementResult => ({
  success: true,
  placedPosition: position,
})

/**
 * 失敗したPlacementResultを生成
 */
export const createFailedPlacement = (reason: string): PlacementResult => ({
  success: false,
  reason,
})
