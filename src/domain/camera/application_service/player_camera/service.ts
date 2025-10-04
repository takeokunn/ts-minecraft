import { Context, Effect, Option } from 'effect'
import type {
  AnimationConfig,
  CameraId,
  PlayerCameraPreferences,
  PlayerId,
  Position3D,
  Vector3D,
  ViewMode,
  ViewModeTransitionConfig,
} from '../../types/index.js'
import type {
  CameraApplicationError,
  PlayerCameraInput,
  PlayerCameraSettingsUpdate,
  PlayerCameraState,
  PlayerCameraStatistics,
  ViewModeTransitionResult,
} from './types.js'

/**
 * Player Camera Application Service Interface
 *
 * プレイヤーカメラのユースケースを実現するApplication Serviceです。
 * このサービスは以下の責務を持ちます：
 *
 * 1. プレイヤーカメラの初期化・破棄
 * 2. プレイヤー入力の処理とカメラ更新
 * 3. ビューモードの切り替え管理
 * 4. カメラ設定の適用と管理
 * 5. プレイヤー位置連動の管理
 * 6. パフォーマンス監視と最適化
 */
export interface PlayerCameraApplicationService {
  /**
   * プレイヤーカメラを初期化します
   *
   * @param playerId - プレイヤーID
   * @param initialPosition - 初期位置
   * @param preferences - カメラ設定（オプション）
   * @returns 作成されたカメラのID
   */
  readonly initializePlayerCamera: (
    playerId: PlayerId,
    initialPosition: Position3D,
    preferences: Option<PlayerCameraPreferences>
  ) => Effect.Effect<CameraId, CameraApplicationError>

  /**
   * プレイヤー入力を処理してカメラを更新します
   *
   * @param playerId - プレイヤーID
   * @param input - プレイヤー入力
   * @returns 更新処理の結果
   */
  readonly handlePlayerInput: (
    playerId: PlayerId,
    input: PlayerCameraInput
  ) => Effect.Effect<void, CameraApplicationError>

  /**
   * プレイヤーの位置更新に連動してカメラを更新します
   *
   * @param playerId - プレイヤーID
   * @param newPosition - 新しい位置
   * @param velocity - 移動速度（オプション）
   * @returns 更新処理の結果
   */
  readonly updatePlayerPosition: (
    playerId: PlayerId,
    newPosition: Position3D,
    velocity: Option<Vector3D>
  ) => Effect.Effect<void, CameraApplicationError>

  /**
   * ビューモードを切り替えます
   *
   * @param playerId - プレイヤーID
   * @param targetMode - 切り替え先のビューモード
   * @param transitionConfig - 遷移設定（オプション）
   * @returns 遷移結果
   */
  readonly switchViewMode: (
    playerId: PlayerId,
    targetMode: ViewMode,
    transitionConfig: Option<ViewModeTransitionConfig>
  ) => Effect.Effect<ViewModeTransitionResult, CameraApplicationError>

  /**
   * カメラ設定を更新します
   *
   * @param playerId - プレイヤーID
   * @param settingsUpdate - 設定更新内容
   * @returns 更新処理の結果
   */
  readonly applySettingsUpdate: (
    playerId: PlayerId,
    settingsUpdate: PlayerCameraSettingsUpdate
  ) => Effect.Effect<void, CameraApplicationError>

  /**
   * プレイヤーカメラの現在状態を取得します
   *
   * @param playerId - プレイヤーID
   * @returns カメラ状態
   */
  readonly getPlayerCameraState: (playerId: PlayerId) => Effect.Effect<PlayerCameraState, CameraApplicationError>

  /**
   * プレイヤーカメラを破棄します
   *
   * @param playerId - プレイヤーID
   * @returns 破棄処理の結果
   */
  readonly destroyPlayerCamera: (playerId: PlayerId) => Effect.Effect<void, CameraApplicationError>

  /**
   * カメラのアニメーションを開始します
   *
   * @param playerId - プレイヤーID
   * @param animationConfig - アニメーション設定
   * @returns アニメーション開始結果
   */
  readonly startCameraAnimation: (
    playerId: PlayerId,
    animationConfig: AnimationConfig
  ) => Effect.Effect<void, CameraApplicationError>

  /**
   * カメラのアニメーションを停止します
   *
   * @param playerId - プレイヤーID
   * @param immediate - 即座に停止するかどうか
   * @returns アニメーション停止結果
   */
  readonly stopCameraAnimation: (playerId: PlayerId, immediate: boolean) => Effect.Effect<void, CameraApplicationError>

  /**
   * カメラを手動でリセットします
   *
   * @param playerId - プレイヤーID
   * @param resetPosition - 位置もリセットするかどうか
   * @returns リセット処理の結果
   */
  readonly resetCamera: (playerId: PlayerId, resetPosition: boolean) => Effect.Effect<void, CameraApplicationError>

  /**
   * 複数のプレイヤーカメラを一括更新します
   *
   * @param updates - プレイヤーIDと更新内容のペアの配列
   * @returns 更新結果の配列
   */
  readonly batchUpdatePlayerCameras: (
    updates: Array.ReadonlyArray<{
      readonly playerId: PlayerId
      readonly input: PlayerCameraInput
    }>
  ) => Effect.Effect<Array.ReadonlyArray<void>, CameraApplicationError>

  /**
   * プレイヤーカメラの統計情報を取得します
   *
   * @param playerId - プレイヤーID
   * @returns 統計情報
   */
  readonly getPlayerCameraStatistics: (
    playerId: PlayerId
  ) => Effect.Effect<PlayerCameraStatistics, CameraApplicationError>

  /**
   * 全プレイヤーカメラの統計情報を取得します
   *
   * @returns 全プレイヤーの統計情報
   */
  readonly getAllPlayerCameraStatistics: () => Effect.Effect<
    Array.ReadonlyArray<{
      readonly playerId: PlayerId
      readonly statistics: PlayerCameraStatistics
    }>,
    CameraApplicationError
  >

  /**
   * パフォーマンス最適化を実行します
   *
   * @param targetMetrics - 目標パフォーマンス指標
   * @returns 最適化結果
   */
  readonly optimizePerformance: (targetMetrics: {
    readonly maxFrameTime: number
    readonly maxMemoryUsage: number
    readonly targetFPS: number
  }) => Effect.Effect<
    {
      readonly optimizationsApplied: Array.ReadonlyArray<string>
      readonly performanceImprovement: number
    },
    CameraApplicationError
  >

  /**
   * デバッグ情報を取得します
   *
   * @param playerId - プレイヤーID
   * @returns デバッグ情報
   */
  readonly getDebugInfo: (playerId: PlayerId) => Effect.Effect<
    {
      readonly currentState: PlayerCameraState
      readonly recentInputs: Array.ReadonlyArray<PlayerCameraInput>
      readonly performanceMetrics: PlayerCameraStatistics
      readonly memoryUsage: number
    },
    CameraApplicationError
  >
}

/**
 * Player Camera Application Service Context Tag
 *
 * 依存性注入で使用するContextタグです。
 * Layer.effectでの実装提供とEffect.genでの利用で使用されます。
 */
export const PlayerCameraApplicationService = Context.GenericTag<PlayerCameraApplicationService>(
  '@minecraft/domain/camera/PlayerCameraApplicationService'
)
