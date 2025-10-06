import { Array, Clock, Data, Effect, Layer, Match, Option, pipe } from 'effect'
import type {
  CameraApplicationError,
  KeyboardAction,
  PlayerCameraApplicationService,
  PlayerCameraInput,
  PlayerCameraState,
  PlayerCameraStatistics,
  ViewModeTransitionFailureReason,
} from './index'
import { createCameraApplicationError, createViewModeTransitionResult } from './index'

// Domain Service Dependencies
import type {
  AnimationEngineService,
  CameraControlService,
  CollisionDetectionService,
  SettingsValidatorService,
  ViewModeManagerService,
} from '../../domain_service/index'

// Repository Dependencies
import type {
  AnimationHistoryRepository,
  CameraStateRepository,
  SettingsStorageRepository,
  ViewModePreferencesRepository,
} from '../../repository/index'

// Aggregate Dependencies

// Value Object Dependencies
import type { CameraId, CameraSettings, MouseDelta, PlayerId, ViewMode } from '../../value_object/index'

/**
 * Player Camera Application Service Live Implementation
 *
 * プレイヤーカメラのユースケースを実現するApplication Serviceの実装です。
 * 複数のDomain ServiceとRepositoryを統合してビジネスロジックを実現します。
 */
export const PlayerCameraApplicationServiceLive = Layer.effect(
  PlayerCameraApplicationService,
  Effect.gen(function* () {
    // === Dependencies Injection ===
    const cameraStateRepo = yield* CameraStateRepository
    const settingsRepo = yield* SettingsStorageRepository
    const animationHistoryRepo = yield* AnimationHistoryRepository
    const preferencesRepo = yield* ViewModePreferencesRepository

    const cameraControlService = yield* CameraControlService
    const animationEngine = yield* AnimationEngineService
    const collisionDetection = yield* CollisionDetectionService
    const settingsValidator = yield* SettingsValidatorService
    const viewModeManager = yield* ViewModeManagerService

    // === Internal State Management ===
    const playerCameras = new Map<PlayerId, PlayerCameraState>()
    const activeAnimations = new Map<PlayerId, any>() // AnimationState
    const performanceMetrics = new Map<PlayerId, PlayerCameraStatistics>()

    // === Helper Functions ===

    /**
     * プレイヤーカメラ状態を取得（内部用）
     */
    const findPlayerCamera = (playerId: PlayerId): Effect.Effect<PlayerCameraState, CameraApplicationError> =>
      pipe(
        Option.fromNullable(playerCameras.get(playerId)),
        Option.match({
          onNone: () => Effect.fail(createCameraApplicationError.playerNotFound(playerId)),
          onSome: Effect.succeed,
        })
      )

    /**
     * デフォルトカメラ設定を作成
     */
    const createDefaultPlayerCameraSettings = (): Effect.Effect<CameraSettings, CameraApplicationError> =>
      Effect.succeed({
        fov: 75,
        sensitivity: 1.0,
        smoothing: 0.1,
        invertY: false,
        renderDistance: 16,
        qualityLevel: 'medium',
      } as CameraSettings)

    /**
     * カメラIDを生成
     */
    const generateCameraId = (): Effect.Effect<CameraId, never> =>
      Effect.gen(function* () {
        const now = yield* Clock.currentTimeMillis
        return `camera-${now}-${Math.random().toString(36).substr(2, 9)}` as CameraId
      })

    /**
     * ビューモード切り替え可能性チェック
     */
    const canSwitchViewMode = (
      currentMode: ViewMode,
      targetMode: ViewMode,
      currentState: PlayerCameraState
    ): Effect.Effect<boolean, CameraApplicationError> =>
      Effect.gen(function* () {
        // アニメーション中は切り替え禁止
        if (Option.isSome(currentState.animationState)) {
          return false
        }

        // ドメインサービスによる互換性チェック
        const compatibility = yield* viewModeManager.checkModeCompatibility(currentMode, targetMode)
        return compatibility.canSwitch
      })

    /**
     * マウス入力処理
     */
    const handleMouseInput = (
      playerState: PlayerCameraState,
      deltaX: MouseDelta,
      deltaY: MouseDelta
    ): Effect.Effect<PlayerCameraState, CameraApplicationError> =>
      Effect.gen(function* () {
        // カメラ制御サービスでマウス入力を処理
        const newRotation = yield* cameraControlService.processMouseInput(
          playerState.rotation,
          deltaX,
          deltaY,
          playerState.settings
        )

        const updatedState = {
          ...playerState,
          rotation: newRotation,
          lastUpdate: now,
        } as PlayerCameraState

        return updatedState
      })

    /**
     * キーボードアクション処理
     */
    const handleKeyboardAction = (
      playerState: PlayerCameraState,
      action: KeyboardAction
    ): Effect.Effect<PlayerCameraState, CameraApplicationError> =>
      pipe(
        action,
        Match.value,
        Match.tag('ZoomIn', () =>
          Effect.gen(function* () {
            const newSettings = yield* cameraControlService.adjustFOV(
              playerState.settings,
              -5 // FOV減少でズームイン
            )
            return { ...playerState, settings: newSettings, lastUpdate: now } as PlayerCameraState
          })
        ),
        Match.tag('ZoomOut', () =>
          Effect.gen(function* () {
            const newSettings = yield* cameraControlService.adjustFOV(
              playerState.settings,
              5 // FOV増加でズームアウト
            )
            return { ...playerState, settings: newSettings, lastUpdate: now } as PlayerCameraState
          })
        ),
        Match.tag('ResetCamera', () =>
          Effect.gen(function* () {
            const defaultRotation = yield* cameraControlService.getDefaultRotation()
            return {
              ...playerState,
              rotation: defaultRotation,
              lastUpdate: now,
            } as PlayerCameraState
          })
        ),
        Match.tag('ToggleFreeLook', () =>
          Effect.succeed({
            ...playerState,
            lastUpdate: now,
          } as PlayerCameraState)
        ),
        Match.tag('CenterView', () =>
          Effect.gen(function* () {
            const centeredRotation = yield* cameraControlService.centerView(playerState.rotation)
            return {
              ...playerState,
              rotation: centeredRotation,
              lastUpdate: now,
            } as PlayerCameraState
          })
        ),
        Match.tag('CycleCameraMode', () =>
          Effect.gen(function* () {
            const nextMode = yield* viewModeManager.getNextMode(playerState.viewMode)
            const canSwitch = yield* canSwitchViewMode(playerState.viewMode, nextMode, playerState)

            if (canSwitch) {
              const updatedMode = yield* viewModeManager.switchToMode(playerState.viewMode, nextMode, Option.none())
              return {
                ...playerState,
                viewMode: updatedMode,
                lastUpdate: now,
              } as PlayerCameraState
            }

            return playerState
          })
        ),
        Match.exhaustive
      )

    /**
     * プレイヤーカメラ統計更新
     */
    const updatePlayerStatistics = (playerId: PlayerId, operationType: string): Effect.Effect<void, never> =>
      Effect.gen(function* () {
        const current =
          performanceMetrics.get(playerId) ||
          ({
            totalInputEvents: 0,
            averageFrameTime: 16.67,
            cameraMovements: 0,
            viewModeChanges: 0,
            lastUpdateTime: now,
            memoryUsage: 0,
            performanceMetrics: {
              updateFrequency: 60,
              renderTime: 16.67,
              inputLatency: 10,
              memoryAllocations: 0,
              gpuMemoryUsage: 0,
            },
          } as PlayerCameraStatistics)

        const updated = {
          ...current,
          totalInputEvents: current.totalInputEvents + 1,
          ...(operationType === 'movement' && { cameraMovements: current.cameraMovements + 1 }),
          ...(operationType === 'viewModeSwitch' && { viewModeChanges: current.viewModeChanges + 1 }),
          lastUpdateTime: now,
        } as PlayerCameraStatistics

        performanceMetrics.set(playerId, updated)
      })

    // === Public Interface Implementation ===

    return PlayerCameraApplicationService.of({
      initializePlayerCamera: (playerId, initialPosition, preferences) =>
        Effect.gen(function* () {
          // 既存カメラの確認
          const existingCamera = playerCameras.get(playerId)
          if (existingCamera) {
            return existingCamera.cameraId
          }

          // 設定の取得または作成
          const settings = yield* pipe(
            preferences,
            Option.match({
              onNone: () => settingsRepo.loadPlayerSettings(playerId),
              onSome: (prefs) => Effect.succeed(Option.some(prefs.settings)),
            }),
            Effect.flatMap(
              Option.match({
                onNone: () => createDefaultPlayerCameraSettings(),
                onSome: Effect.succeed,
              })
            )
          )

          // カメラIDの生成
          const cameraId = yield* generateCameraId()

          // カメラ状態の作成
          const initialRotation = yield* cameraControlService.getDefaultRotation()
          const playerCameraState = {
            playerId,
            cameraId,
            position: initialPosition,
            rotation: initialRotation,
            viewMode: { _tag: 'FirstPerson' } as ViewMode, // デフォルトはファーストパーソン
            settings,
            isInitialized: true,
            lastUpdate: now,
            animationState: Option.none(),
          } as PlayerCameraState

          // 状態の永続化
          playerCameras.set(playerId, playerCameraState)
          yield* settingsRepo.savePlayerSettings(playerId, settings)

          // 統計の初期化
          yield* updatePlayerStatistics(playerId, 'initialization')

          return cameraId
        }),

      handlePlayerInput: (playerId, input) =>
        Effect.gen(function* () {
          const playerState = yield* findPlayerCamera(playerId)

          const updatedState = yield* pipe(
            input,
            Match.value,
            Match.tag('MouseMovement', ({ deltaX, deltaY }) => handleMouseInput(playerState, deltaX, deltaY)),
            Match.tag('KeyboardInput', ({ action }) => handleKeyboardAction(playerState, action)),
            Match.tag('ViewModeSwitch', ({ targetMode, preservePosition, animationDuration }) =>
              Effect.gen(function* () {
                const canSwitch = yield* canSwitchViewMode(playerState.viewMode, targetMode, playerState)

                if (!canSwitch) {
                  return yield* Effect.fail(
                    createCameraApplicationError.viewModeSwitchNotAllowed(
                      playerState.viewMode,
                      targetMode,
                      'Mode switch not allowed in current state'
                    )
                  )
                }

                const newMode = yield* viewModeManager.switchToMode(playerState.viewMode, targetMode, animationDuration)

                yield* updatePlayerStatistics(playerId, 'viewModeSwitch')

                return {
                  ...playerState,
                  viewMode: newMode,
                  lastUpdate: now,
                } as PlayerCameraState
              })
            ),
            Match.tag('SettingsUpdate', ({ settings, immediate }) =>
              Effect.gen(function* () {
                const validatedSettings = yield* settingsValidator.validateSettings({
                  ...playerState.settings,
                  ...settings,
                })

                return {
                  ...playerState,
                  settings: validatedSettings,
                  lastUpdate: now,
                } as PlayerCameraState
              })
            ),
            Match.exhaustive
          )

          // 状態の更新
          playerCameras.set(playerId, updatedState)
          yield* updatePlayerStatistics(playerId, 'input')
        }),

      updatePlayerPosition: (playerId, newPosition, velocity) =>
        Effect.gen(function* () {
          const playerState = yield* findPlayerCamera(playerId)

          // カメラ位置の計算（ビューモードに依存）
          const cameraPosition = yield* cameraControlService.calculateCameraPosition(
            newPosition,
            playerState.viewMode,
            playerState.settings
          )

          // 衝突検出
          const collisionResult = yield* collisionDetection.checkCameraCollision(cameraPosition, playerState.rotation)

          const finalPosition = collisionResult.hasCollision ? collisionResult.adjustedPosition : cameraPosition

          const updatedState = {
            ...playerState,
            position: finalPosition,
            lastUpdate: now,
          } as PlayerCameraState

          playerCameras.set(playerId, updatedState)
          yield* updatePlayerStatistics(playerId, 'movement')
        }),

      switchViewMode: (playerId, targetMode, transitionConfig) =>
        Effect.gen(function* () {
          const playerState = yield* findPlayerCamera(playerId)

          const canSwitch = yield* canSwitchViewMode(playerState.viewMode, targetMode, playerState)

          if (!canSwitch) {
            const reason = Data.struct({
              _tag: 'ModeNotSupported' as const,
              mode: targetMode,
            }) as ViewModeTransitionFailureReason

            return createViewModeTransitionResult.failed(reason, playerState.viewMode, targetMode)
          }

          // アニメーション付き切り替え
          const animationDuration = Option.getOrElse(
            Option.flatMap(transitionConfig, (config) => Option.some(config.duration)),
            () => 500 // デフォルト500ms
          )

          const animation = yield* animationEngine.createViewModeTransition(
            playerState.viewMode,
            targetMode,
            animationDuration
          )

          const newMode = yield* viewModeManager.switchToMode(playerState.viewMode, targetMode, Option.some(animation))

          const updatedState = {
            ...playerState,
            viewMode: newMode,
            animationState: Option.some(animation),
            lastUpdate: now,
          } as PlayerCameraState

          playerCameras.set(playerId, updatedState)
          yield* updatePlayerStatistics(playerId, 'viewModeSwitch')

          // 設定の学習記録
          yield* preferencesRepo.recordViewModeSwitch(playerId, playerState.viewMode, targetMode)

          return createViewModeTransitionResult.success(playerState.viewMode, targetMode, animationDuration, true)
        }),

      applySettingsUpdate: (playerId, settingsUpdate) =>
        Effect.gen(function* () {
          const playerState = yield* findPlayerCamera(playerId)

          const newSettings = {
            ...playerState.settings,
            ...Object.fromEntries(
              Object.entries(settingsUpdate)
                .filter(([_, value]) => Option.isSome(value))
                .map(([key, value]) => [key, Option.getOrNull(value)])
            ),
          } as CameraSettings

          const validatedSettings = yield* settingsValidator.validateSettings(newSettings)

          const updatedState = {
            ...playerState,
            settings: validatedSettings,
            lastUpdate: now,
          } as PlayerCameraState

          playerCameras.set(playerId, updatedState)
          yield* settingsRepo.savePlayerSettings(playerId, validatedSettings)
        }),

      getPlayerCameraState: (playerId) => findPlayerCamera(playerId),

      destroyPlayerCamera: (playerId) =>
        Effect.gen(function* () {
          const playerState = yield* findPlayerCamera(playerId)

          // アニメーションの停止
          if (Option.isSome(playerState.animationState)) {
            yield* animationEngine.stopAnimation(Option.getOrThrow(playerState.animationState))
          }

          // 状態の削除
          playerCameras.delete(playerId)
          activeAnimations.delete(playerId)
          performanceMetrics.delete(playerId)

          // 統計の記録
          yield* animationHistoryRepo.recordCameraDestruction(playerState.cameraId)
        }),

      startCameraAnimation: (playerId, animationConfig) =>
        Effect.gen(function* () {
          const playerState = yield* findPlayerCamera(playerId)

          const animation = yield* animationEngine.createAnimation(animationConfig)

          const updatedState = {
            ...playerState,
            animationState: Option.some(animation),
            lastUpdate: now,
          } as PlayerCameraState

          playerCameras.set(playerId, updatedState)
          activeAnimations.set(playerId, animation)
        }),

      stopCameraAnimation: (playerId, immediate) =>
        Effect.gen(function* () {
          const playerState = yield* findPlayerCamera(playerId)

          if (Option.isSome(playerState.animationState)) {
            const animation = Option.getOrThrow(playerState.animationState)

            if (immediate) {
              yield* animationEngine.stopAnimation(animation)
            } else {
              yield* animationEngine.fadeOutAnimation(animation, 200) // 200ms フェードアウト
            }

            const updatedState = {
              ...playerState,
              animationState: Option.none(),
              lastUpdate: now,
            } as PlayerCameraState

            playerCameras.set(playerId, updatedState)
            activeAnimations.delete(playerId)
          }
        }),

      resetCamera: (playerId, resetPosition) =>
        Effect.gen(function* () {
          const playerState = yield* findPlayerCamera(playerId)

          const defaultRotation = yield* cameraControlService.getDefaultRotation()
          const defaultSettings = yield* createDefaultPlayerCameraSettings()

          const updatedState = {
            ...playerState,
            rotation: defaultRotation,
            settings: resetPosition ? defaultSettings : playerState.settings,
            animationState: Option.none(),
            lastUpdate: now,
          } as PlayerCameraState

          playerCameras.set(playerId, updatedState)

          // アニメーションの停止
          if (activeAnimations.has(playerId)) {
            const animation = activeAnimations.get(playerId)!
            yield* animationEngine.stopAnimation(animation)
            activeAnimations.delete(playerId)
          }
        }),

      batchUpdatePlayerCameras: (updates) =>
        Effect.all(
          updates.map(({ playerId, input }) =>
            Effect.catchAll(
              Effect.flatMap(findPlayerCamera(playerId), () => Effect.void),
              () => Effect.void // エラーは無視してスキップ
            )
          ),
          { concurrency: 'unbounded' }
        ),

      getPlayerCameraStatistics: (playerId) =>
        Effect.gen(function* () {
          yield* findPlayerCamera(playerId) // プレイヤーの存在確認

          const stats = performanceMetrics.get(playerId)
          if (!stats) {
            return yield* Effect.fail(createCameraApplicationError.playerNotFound(playerId))
          }

          return stats
        }),

      getAllPlayerCameraStatistics: () =>
        Effect.succeed(
          Array.from(performanceMetrics.entries()).map(([playerId, statistics]) => ({
            playerId,
            statistics,
          }))
        ),

      optimizePerformance: (targetMetrics) =>
        Effect.gen(function* () {
          const now = yield* Clock.currentTimeMillis
          const optimizations: string[] = []
          let improvementFactor = 0

          // メモリ使用量の最適化
          if (performanceMetrics.size > 100) {
            const oldEntries = Array.from(performanceMetrics.entries()).filter(
              ([_, stats]) => now - stats.lastUpdateTime > 300000
            ) // 5分以上古い

            oldEntries.forEach(([playerId]) => {
              performanceMetrics.delete(playerId)
            })

            optimizations.push(`Cleaned up ${oldEntries.length} old player statistics`)
            improvementFactor += oldEntries.length * 0.1
          }

          // アニメーションの最適化
          if (activeAnimations.size > 50) {
            let stoppedAnimations = 0
            for (const [playerId, animation] of activeAnimations.entries()) {
              yield* animationEngine.optimizeAnimation(animation)
              stoppedAnimations++
            }

            optimizations.push(`Optimized ${stoppedAnimations} active animations`)
            improvementFactor += stoppedAnimations * 0.05
          }

          return {
            optimizationsApplied: optimizations,
            performanceImprovement: Math.min(improvementFactor, 1.0), // 最大100%改善
          }
        }),

      getDebugInfo: (playerId) =>
        Effect.gen(function* () {
          const currentState = yield* findPlayerCamera(playerId)
          const statistics = performanceMetrics.get(playerId)

          if (!statistics) {
            return yield* Effect.fail(createCameraApplicationError.playerNotFound(playerId))
          }

          // 最近の入力履歴（実装簡略化のため空配列）
          const recentInputs: Array.ReadonlyArray<PlayerCameraInput> = []

          return {
            currentState,
            recentInputs,
            performanceMetrics: statistics,
            memoryUsage: process.memoryUsage().heapUsed, // Node.js環境での概算
          }
        }),
    })
  })
)
