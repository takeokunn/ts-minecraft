import type { BlockId, BlockPosition, PlayerId, SessionId } from '@domain/core/types/brands'
import { Data, Predicate } from 'effect'
import type { BlockFace, ToolType, Vector3 } from './InteractionTypes'

// =============================================================================
// Base Interaction Error Schema
// =============================================================================

/**
 * レイキャスト失敗エラー
 */
export const RaycastError = Data.tagged<{
  readonly _tag: 'RaycastError'
  readonly origin: Vector3
  readonly direction: Vector3
  readonly maxDistance: number
  readonly reason: string
  readonly timestamp: number
}>('RaycastError')

export type RaycastError = ReturnType<typeof RaycastError>

/**
 * ブロック破壊エラー
 */
export const BlockBreakingError = Data.tagged<{
  readonly _tag: 'BlockBreakingError'
  readonly playerId: PlayerId
  readonly blockPosition: BlockPosition
  readonly toolType: ToolType | null
  readonly reason: string
  readonly timestamp: number
}>('BlockBreakingError')

export type BlockBreakingError = ReturnType<typeof BlockBreakingError>

/**
 * ブロック設置エラー
 */
export const BlockPlacementError = Data.tagged<{
  readonly _tag: 'BlockPlacementError'
  readonly playerId: PlayerId
  readonly position: BlockPosition
  readonly blockId: BlockId
  readonly face: BlockFace
  readonly reason: string
  readonly timestamp: number
}>('BlockPlacementError')

export type BlockPlacementError = ReturnType<typeof BlockPlacementError>

/**
 * ブロック破壊セッションエラー
 */
export const BreakingSessionError = Data.tagged<{
  readonly _tag: 'BreakingSessionError'
  readonly sessionId: SessionId
  readonly playerId: PlayerId
  readonly reason: string
  readonly timestamp: number
}>('BreakingSessionError')

export type BreakingSessionError = ReturnType<typeof BreakingSessionError>

/**
 * インタラクション検証エラー
 */
export const InteractionValidationError = Data.tagged<{
  readonly _tag: 'InteractionValidationError'
  readonly field: string
  readonly value: unknown
  readonly expectedType: string
  readonly reason: string
  readonly timestamp: number
}>('InteractionValidationError')

export type InteractionValidationError = ReturnType<typeof InteractionValidationError>

// =============================================================================
// Union Type for All Interaction Errors
// =============================================================================

/**
 * 全てのインタラクションエラーのUnion型
 */
export type InteractionError =
  | RaycastError
  | BlockBreakingError
  | BlockPlacementError
  | BreakingSessionError
  | InteractionValidationError

// =============================================================================
// Error Factory Functions
// =============================================================================

/**
 * レイキャストエラーを生成
 */
export const createRaycastError = (params: {
  origin: Vector3
  direction: Vector3
  maxDistance: number
  reason: string
}): RaycastError =>
  RaycastError({
    ...params,
    timestamp: Date.now(),
  })

/**
 * ブロック破壊エラーを生成
 */
export const createBlockBreakingError = (params: {
  playerId: PlayerId
  blockPosition: BlockPosition
  toolType: ToolType | null
  reason: string
}): BlockBreakingError =>
  BlockBreakingError({
    playerId: params.playerId,
    blockPosition: params.blockPosition,
    toolType: params.toolType,
    reason: params.reason,
    timestamp: Date.now(),
  })

/**
 * ブロック設置エラーを生成
 */
export const createBlockPlacementError = (params: {
  playerId: PlayerId
  position: BlockPosition
  blockId: BlockId
  face: BlockFace
  reason: string
}): BlockPlacementError =>
  BlockPlacementError({
    playerId: params.playerId,
    position: params.position,
    blockId: params.blockId,
    face: params.face,
    reason: params.reason,
    timestamp: Date.now(),
  })

/**
 * ブロック破壊セッションエラーを生成
 */
export const createBreakingSessionError = (params: {
  sessionId: SessionId
  playerId: PlayerId
  reason: string
}): BreakingSessionError =>
  BreakingSessionError({
    sessionId: params.sessionId,
    playerId: params.playerId,
    reason: params.reason,
    timestamp: Date.now(),
  })

/**
 * インタラクション検証エラーを生成
 */
export const createInteractionValidationError = (params: {
  field: string
  value: unknown
  expectedType: string
  reason: string
}): InteractionValidationError =>
  InteractionValidationError({
    ...params,
    timestamp: Date.now(),
  })

// =============================================================================
// Error Guard Functions
// =============================================================================

/**
 * RaycastErrorかどうかを判定
 */
export const isRaycastError = (error: unknown): error is RaycastError =>
  Predicate.isRecord(error) && '_tag' in error && error['_tag'] === 'RaycastError'

/**
 * BlockBreakingErrorかどうかを判定
 */
export const isBlockBreakingError = (error: unknown): error is BlockBreakingError =>
  Predicate.isRecord(error) && '_tag' in error && error['_tag'] === 'BlockBreakingError'

/**
 * BlockPlacementErrorかどうかを判定
 */
export const isBlockPlacementError = (error: unknown): error is BlockPlacementError =>
  Predicate.isRecord(error) && '_tag' in error && error['_tag'] === 'BlockPlacementError'

/**
 * BreakingSessionErrorかどうかを判定
 */
export const isBreakingSessionError = (error: unknown): error is BreakingSessionError =>
  Predicate.isRecord(error) && '_tag' in error && error['_tag'] === 'BreakingSessionError'

/**
 * InteractionValidationErrorかどうかを判定
 */
export const isInteractionValidationError = (error: unknown): error is InteractionValidationError =>
  Predicate.isRecord(error) && '_tag' in error && error['_tag'] === 'InteractionValidationError'

/**
 * InteractionErrorかどうかを判定
 */
export const isInteractionError = (error: unknown): error is InteractionError =>
  isRaycastError(error) ||
  isBlockBreakingError(error) ||
  isBlockPlacementError(error) ||
  isBreakingSessionError(error) ||
  isInteractionValidationError(error)
