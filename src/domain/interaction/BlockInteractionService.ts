import { Context, Effect } from 'effect'
import type { BlockId, BlockPosition, PlayerId, SessionId } from '../../shared/types/branded'
import type {
  Vector3,
  BlockFace,
  ToolType,
  RaycastResult,
  BreakingSession,
  BreakingProgress,
  PlacementResult,
  InteractableBlock,
} from './InteractionTypes'
import type { InteractionError } from './InteractionErrors'

// =============================================================================
// BlockInteractionService Interface
// =============================================================================

/**
 * ブロックインタラクションサービス
 *
 * プレイヤーとブロック間のインタラクション（レイキャスト、破壊、設置）を
 * 管理するサービス。Effect-TSパターンに準拠し、純粋関数型アプローチを採用。
 *
 * 主な機能:
 * - レイキャスト（DDA/Bresenhamアルゴリズム）
 * - ブロック破壊とアニメーション管理
 * - ブロック設置と妥当性検証
 * - インタラクト可能範囲の検索
 */
export interface BlockInteractionService {
  /**
   * レイキャストの実行
   *
   * 指定された原点と方向ベクトルに基づいてレイを飛ばし、
   * 最初に衝突するブロックとその詳細情報を取得する。
   *
   * @param origin - レイの開始点（ワールド座標）
   * @param direction - レイの方向ベクトル（正規化済み）
   * @param maxDistance - レイの最大距離
   * @returns 衝突結果（位置、面、距離等）
   *
   * @example
   * ```typescript
   * const result = yield* service.performRaycast(
   *   { x: 0, y: 64, z: 0 },     // プレイヤー位置
   *   { x: 1, y: 0, z: 0 },     // 東向き
   *   10                         // 最大10ブロック
   * )
   *
   * if (result.hit) {
   *   console.log(`ブロック発見: ${result.blockPosition}`)
   * }
   * ```
   */
  readonly performRaycast: (
    origin: Vector3,
    direction: Vector3,
    maxDistance: number
  ) => Effect.Effect<RaycastResult, InteractionError>

  /**
   * ブロック破壊の開始
   *
   * プレイヤーが特定のブロックの破壊を開始する。
   * ツールタイプと硬度に基づいて破壊時間を計算し、
   * セッションを作成して進捗を追跡する。
   *
   * @param playerId - プレイヤーID
   * @param blockPos - 破壊するブロックの位置
   * @param toolType - 使用するツール（null = 素手）
   * @returns 破壊セッション情報
   *
   * @example
   * ```typescript
   * const session = yield* service.startBlockBreaking(
   *   'player-123' as PlayerId,
   *   { x: 10, y: 64, z: 5 } as BlockPosition,
   *   'pickaxe'
   * )
   *
   * console.log(`破壊開始: セッション${session.sessionId}`)
   * console.log(`完了予定時間: ${session.totalBreakTime}秒`)
   * ```
   */
  readonly startBlockBreaking: (
    playerId: PlayerId,
    blockPos: BlockPosition,
    toolType: ToolType | null
  ) => Effect.Effect<BreakingSession, InteractionError>

  /**
   * ブロック破壊進捗の更新
   *
   * 既存の破壊セッションの進捗を時間経過に基づいて更新する。
   * ゲームループから定期的に呼び出され、破壊アニメーションと
   * 完了判定を行う。
   *
   * @param sessionId - 破壊セッションID
   * @param deltaTime - 前回更新からの経過時間（秒）
   * @returns 更新された進捗情報
   *
   * @example
   * ```typescript
   * const progress = yield* service.updateBlockBreaking(
   *   sessionId,
   *   0.016  // 60FPSでの1フレーム時間
   * )
   *
   * if (progress.isComplete) {
   *   console.log('ブロック破壊完了!')
   * } else {
   *   console.log(`進捗: ${Math.round(progress.progress * 100)}%`)
   * }
   * ```
   */
  readonly updateBlockBreaking: (
    sessionId: SessionId,
    deltaTime: number
  ) => Effect.Effect<BreakingProgress, InteractionError>

  /**
   * ブロックの設置
   *
   * 指定された位置にブロックを設置する。
   * 衝突判定、隣接ブロックチェック、物理法則の確認を行い、
   * 妥当性が確認された場合のみ設置を実行する。
   *
   * @param playerId - プレイヤーID
   * @param position - 設置位置
   * @param blockId - 設置するブロックのID
   * @param face - 設置する面（隣接ブロックのどの面に設置するか）
   * @returns 設置結果（成功/失敗と詳細）
   *
   * @example
   * ```typescript
   * const result = yield* service.placeBlock(
   *   'player-123' as PlayerId,
   *   { x: 10, y: 65, z: 5 } as BlockPosition,
   *   'stone' as BlockId,
   *   'top'
   * )
   *
   * if (result.success) {
   *   console.log(`ブロック設置成功: ${result.placedPosition}`)
   * } else {
   *   console.log(`設置失敗: ${result.reason}`)
   * }
   * ```
   */
  readonly placeBlock: (
    playerId: PlayerId,
    position: BlockPosition,
    blockId: BlockId,
    face: BlockFace
  ) => Effect.Effect<PlacementResult, InteractionError>

  /**
   * インタラクト可能ブロックの検索
   *
   * 指定された位置を中心とした範囲内で、
   * プレイヤーがインタラクト可能なブロックを検索する。
   * 破壊可能性、インタラクト可能性、距離等の情報を含む。
   *
   * @param position - 検索中心位置
   * @param range - 検索半径（ブロック単位）
   * @returns インタラクト可能なブロックのリスト
   *
   * @example
   * ```typescript
   * const blocks = yield* service.getInteractableBlocks(
   *   { x: 0, y: 64, z: 0 },  // プレイヤー位置
   *   5                       // 5ブロック半径
   * )
   *
   * const breakableBlocks = blocks.filter(block => block.canBreak)
   * console.log(`破壊可能ブロック: ${breakableBlocks.length}個`)
   * ```
   */
  readonly getInteractableBlocks: (
    position: Vector3,
    range: number
  ) => Effect.Effect<ReadonlyArray<InteractableBlock>, InteractionError>

  /**
   * 破壊セッションの取得
   *
   * 指定されたセッションIDまたはプレイヤーIDに基づいて、
   * 現在アクティブな破壊セッションを取得する。
   *
   * @param sessionId - セッションID
   * @returns 破壊セッション情報（存在しない場合はnull）
   */
  readonly getBreakingSession: (sessionId: SessionId) => Effect.Effect<BreakingSession | null, InteractionError>

  /**
   * プレイヤーの破壊セッションを取得
   *
   * @param playerId - プレイヤーID
   * @returns プレイヤーのアクティブな破壊セッション（存在しない場合はnull）
   */
  readonly getPlayerBreakingSession: (playerId: PlayerId) => Effect.Effect<BreakingSession | null, InteractionError>

  /**
   * 破壊セッションのキャンセル
   *
   * 指定されたセッションを強制的に終了する。
   * プレイヤーが他の行動を開始した場合等に使用。
   *
   * @param sessionId - キャンセルするセッションID
   * @returns void
   */
  readonly cancelBreakingSession: (sessionId: SessionId) => Effect.Effect<void, InteractionError>

  /**
   * 全ての破壊セッションの取得
   *
   * デバッグおよび管理用途で、現在アクティブな
   * 全ての破壊セッションを取得する。
   *
   * @returns アクティブな破壊セッションのリスト
   */
  readonly getAllBreakingSessions: () => Effect.Effect<ReadonlyArray<BreakingSession>, never>

  /**
   * ブロック破壊時間の計算
   *
   * ブロックの硬度とツールタイプに基づいて、
   * 破壊に必要な時間を計算する。Minecraftの
   * 破壊時間計算式に準拠。
   *
   * @param blockId - ブロックID
   * @param toolType - 使用するツール
   * @returns 破壊時間（秒）
   */
  readonly calculateBreakTime: (blockId: BlockId, toolType: ToolType | null) => Effect.Effect<number, InteractionError>
}

// =============================================================================
// Service Tag Definition
// =============================================================================

/**
 * BlockInteractionService用のContextタグ
 *
 * Effect-TSの依存注入システムで使用される。
 * Layer.provideで実装を注入し、Effect.genで取得する。
 */
export const BlockInteractionService = Context.GenericTag<BlockInteractionService>(
  '@minecraft/domain/BlockInteractionService'
)

// =============================================================================
// Type Exports
// =============================================================================

export type { InteractionError } from './InteractionErrors'
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
